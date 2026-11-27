"""The Positional Eval: P(win / loss / draw) for a Position's holder, given only the Position."""

from __future__ import annotations

from collections.abc import Sequence

import pandas as pd

from .corpus import DRAW, Corpus

#: The default saturation cap, in seconds.
DEFAULT_CAP = 30.0

RESULTS = ("win", "loss", "draw")

CONTRIBUTION_COLUMNS = [
    "annotation_id",
    "position_id",
    "family",
    "athlete",
    "segments",
    "raw_weight",
    "weight",
    "result",
]


def eval_contributions(corpus: Corpus, *, cap: float = DEFAULT_CAP) -> pd.DataFrame:
    """One row per Match × Position × Athlete: what that Match contributes to the Eval.

    The Athlete is the perspective of each Segment: the first Role holder for
    an asymmetric Position, the Initiator of the incoming Transition for a
    symmetric one. Each Segment weighs `min(duration, cap) / cap`;
    `raw_weight` is their sum and `weight` is that sum capped at 1, so one
    Match counts at most once per Position per Athlete. `result` is the
    Match Result from the Athlete's side (win / loss / draw); only a Result
    whose Method is `draw` counts as a draw.

    Segments with no perspective (a symmetric Position entered by a Reset or
    at the Match start, or a Role holder not yet recorded) and Matches with
    no Result are left out.
    """
    if cap <= 0:
        raise ValueError("cap must be positive")
    results = {
        row["annotation_id"]: (row["winner"], row["method"]) for row in corpus.matches.to_dict("records")
    }
    segments = corpus.segments.copy()
    perspective = segments["initiator"].where(segments["symmetric"], segments["first_role_holder"])
    segments["athlete"] = perspective
    segments = segments[segments["athlete"].notna()]
    segments = segments[segments["annotation_id"].map(lambda i: _has_result(results[i]))]
    segments["segment_weight"] = segments["duration"].clip(upper=cap) / cap

    table = (
        segments.groupby(["annotation_id", "position_id", "family", "athlete"], sort=True)
        .agg(segments=("segment_weight", "size"), raw_weight=("segment_weight", "sum"))
        .reset_index()
    )
    table["weight"] = table["raw_weight"].clip(upper=1.0)
    table["result"] = [
        _result_for(results[annotation_id], athlete)
        for annotation_id, athlete in zip(table["annotation_id"], table["athlete"])
    ]
    return table[CONTRIBUTION_COLUMNS]


#: The headline perspective of each kind of Position, and its mirror.
FIRST_ROLE = "first_role"
SECOND_ROLE = "second_role"
INITIATOR = "initiator"
OPPONENT = "opponent"

EVAL_COLUMNS = [
    "position_id",
    "name",
    "family",
    "symmetric",
    "perspective",
    "role",
    "matches",
    "segments",
    "weight",
    *[f"p_{o}{suffix}" for o in RESULTS for suffix in ("", "_low", "_high")],
    "family_weight",
    *[f"family_p_{o}" for o in RESULTS],
]


def positional_eval_by_perspective(
    corpus: Corpus,
    *,
    cap: float = DEFAULT_CAP,
    prior_strength: float = 2.0,
    family_prior_strength: float = 1.0,
    base_prior_strength: float = 1.0,
    credible_mass: float = 0.9,
) -> pd.DataFrame:
    """The Positional Eval of every Position seen in the Corpus, from both sides.

    Two rows per Position. For an asymmetric Position, `perspective` is
    `first_role` (the first Role holder, the headline) or `second_role`, and
    `role` names the Role. For a symmetric Position it is `initiator` (the
    Athlete whose Transition led into it, the headline) or `opponent`, and
    `role` is empty. The mirror row swaps win and loss, so look up "how good
    is this Position for the Athlete in it" with `position_id` plus the
    perspective that Athlete holds.

    The model is a Dirichlet-multinomial pooled from Position into Family.
    With n = the weighted (win, loss, draw) counts of a Position from
    `eval_contributions` and n_F those of the other Positions in its Family
    (leave-one-out: the Position's own data is not in n_F; N, N_F in all):

        φ_F       = (n_F + β u) / (N_F + β)            the rest of the Family's mean
        θ | data  ~ Dirichlet(n + α φ_F + γ u)          the Position's posterior

    where u = (1/3, 1/3, 1/3), α is `prior_strength`, β is
    `family_prior_strength` and γ is `base_prior_strength`. A rare Position
    is pulled towards its Family and a well-sampled one keeps its own data.
    A Position with no other data in its Family (N_F = 0) gets φ_F = u, the
    plain uniform prior. `family_weight` is N_F and `family_p_*` is φ_F.
    γ keeps every Result a little prior mass, so a never-seen Result (draws
    in most Families) still gets an interval that contains its estimate.

    `p_*` is the posterior mean; `p_*_low` / `p_*_high` bound the equal-tailed
    `credible_mass` (default 90%) credible interval of its Beta marginal.
    `matches`, `segments` and `weight` are the sample sizes behind it: the
    Matches and Segments that contribute, and their summed capped weight.
    Each Match counts at most weight 1 per Position per Athlete, so the
    interval can't be narrowed by one long or chaotic Match.
    """
    if not 0 < credible_mass < 1:
        raise ValueError("credible_mass must be between 0 and 1")
    from scipy.stats import beta

    vocabulary = corpus.vocabulary
    contributions = eval_contributions(corpus, cap=cap)
    counts = (
        contributions.pivot_table(index="position_id", columns="result", values="weight", aggfunc="sum")
        .reindex(columns=list(RESULTS))
        .fillna(0.0)
    )
    sizes = contributions.groupby("position_id").agg(
        matches=("annotation_id", "nunique"), segments=("segments", "sum"), weight=("weight", "sum")
    )
    positions = sorted(set(corpus.segments["position_id"]))
    family_counts = counts.groupby(lambda p: vocabulary.family_of(p)).sum()

    tail = (1 - credible_mass) / 2
    uniform = 1 / len(RESULTS)
    rows = []
    for position_id in positions:
        family = vocabulary.family_of(position_id)
        n = [float(counts.loc[position_id, o]) if position_id in counts.index else 0.0 for o in RESULTS]
        # Leave the Position's own data out of its Family prior, so it isn't counted twice.
        n_family = [
            (float(family_counts.loc[family, o]) if family in family_counts.index else 0.0) - k
            for o, k in zip(RESULTS, n)
        ]
        family_total = sum(n_family)
        family_mean = [
            (k + family_prior_strength * uniform) / (family_total + family_prior_strength) for k in n_family
        ]
        alpha = [k + prior_strength * f + base_prior_strength * uniform for k, f in zip(n, family_mean)]
        total = sum(alpha)
        estimate = {}
        for result, a in zip(RESULTS, alpha):
            estimate[result] = (
                a / total,
                float(beta.ppf(tail, a, total - a)),
                float(beta.ppf(1 - tail, a, total - a)),
            )
        family_estimate = dict(zip(RESULTS, family_mean))
        size = sizes.loc[position_id] if position_id in sizes.index else None
        symmetric = vocabulary.is_symmetric(position_id)
        roles = vocabulary.positions[position_id].get("roles") or [None, None]
        headline, mirror = (INITIATOR, OPPONENT) if symmetric else (FIRST_ROLE, SECOND_ROLE)
        for perspective, role, swap in ((headline, roles[0], False), (mirror, roles[1], True)):
            seen = {"win": "loss", "loss": "win", "draw": "draw"} if swap else {o: o for o in RESULTS}
            row = {
                "position_id": position_id,
                "name": vocabulary.positions[position_id]["name"],
                "family": family,
                "symmetric": symmetric,
                "perspective": perspective,
                "role": role,
                "matches": int(size["matches"]) if size is not None else 0,
                "segments": int(size["segments"]) if size is not None else 0,
                "weight": float(size["weight"]) if size is not None else 0.0,
                "family_weight": family_total,
            }
            for result in RESULTS:
                mean, low, high = estimate[seen[result]]
                row[f"p_{result}"] = mean
                row[f"p_{result}_low"] = low
                row[f"p_{result}_high"] = high
                row[f"family_p_{result}"] = family_estimate[seen[result]]
            rows.append(row)
    return pd.DataFrame(rows, columns=EVAL_COLUMNS)


def positional_eval(corpus: Corpus, **options) -> pd.DataFrame:
    """The Positional Eval of every Position, one row each, from its headline perspective.

    The headline perspective is the first Role holder for an asymmetric
    Position and the Initiator for a symmetric one. Takes the same options
    as `positional_eval_by_perspective`, which explains the model and also
    gives the mirror perspective of each Position.
    """
    table = positional_eval_by_perspective(corpus, **options)
    return table[table["perspective"].isin([FIRST_ROLE, INITIATOR])].reset_index(drop=True)


SENSITIVITY_CAPS = (15.0, 30.0, 60.0)


def eval_sensitivity(corpus: Corpus, *, caps: Sequence[float] = SENSITIVITY_CAPS, **options) -> pd.DataFrame:
    """The headline Positional Eval re-run at each saturation cap (default 15s / 30s / 60s).

    The rows of `positional_eval` for every cap, stacked, with a `cap` column
    first. Other options go to `positional_eval`. If a conclusion flips
    between caps, it depends on how brief holds are weighted.
    """
    tables = [positional_eval(corpus, cap=cap, **options).assign(cap=cap) for cap in caps]
    table = pd.concat(tables, ignore_index=True)
    return table[["cap", *EVAL_COLUMNS]].sort_values(["position_id", "cap"]).reset_index(drop=True)


def _has_result(result: tuple) -> bool:
    """True for a complete Result: a Method, with a winner unless the Method is a draw."""
    winner, method = (None if value is None or pd.isna(value) else value for value in result)
    return method is not None and (method == DRAW) == (winner is None)


def _result_for(result: tuple, athlete: str) -> str:
    winner, method = result
    if method == DRAW:
        return "draw"
    return "win" if winner == athlete else "loss"
