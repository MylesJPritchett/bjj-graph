"""Short-horizon outcomes: how often entering a Position leads to a Score Event soon after."""

from __future__ import annotations

import pandas as pd

from .corpus import Corpus
from .vocabulary import RESET

#: The default horizon, in seconds.
DEFAULT_HORIZON = 30.0

ENTRY_COLUMNS = [
    "annotation_id",
    "segment_index",
    "position_id",
    "family",
    "start",
    "window_end",
    "outcome",
]


def short_horizon_entries(corpus: Corpus, *, horizon: float = DEFAULT_HORIZON) -> pd.DataFrame:
    """One row per Segment (each entry into a Position) and whether something was scored soon after.

    The window opens when the Segment starts and closes `horizon` seconds
    later, at the start of the next Reset, or at the end of the Match,
    whichever comes first. It runs on past the Segment's own end: the
    question is where entering the Position leads, not what happens while it
    is held. `outcome` is true if any Score Event, for either Athlete, falls
    inside the window (both ends included). A Match won by submission counts
    as a finish at the Match end even if no submission-finish Score Event
    was recorded.
    """
    if horizon <= 0:
        raise ValueError("horizon must be positive")
    times = {doc["id"]: _outcome_times(doc) for doc in corpus.annotations}
    ends = dict(zip(corpus.matches["annotation_id"], corpus.matches["end_offset"]))
    rows = []
    for annotation_id, segments in corpus.segments.groupby("annotation_id", sort=False):
        ordered = segments.sort_values("segment_index").to_dict("records")
        resets = [s["start"] for s in ordered if s["transition_type"] == RESET]
        for segment in ordered:
            start = segment["start"]
            later_resets = [t for t in resets if t > start]
            window_end = min([start + horizon, ends[annotation_id], *later_resets])
            rows.append(
                {
                    "annotation_id": annotation_id,
                    "segment_index": segment["segment_index"],
                    "position_id": segment["position_id"],
                    "family": segment["family"],
                    "start": start,
                    "window_end": window_end,
                    "outcome": any(start <= t <= window_end for t in times[annotation_id]),
                }
            )
    return pd.DataFrame(rows, columns=ENTRY_COLUMNS)


OUTCOME_COLUMNS = [
    "position_id",
    "name",
    "family",
    "matches",
    "entries",
    "entries_with_outcome",
    "observed_share",
    "weight",
    "p_outcome",
    "p_outcome_low",
    "p_outcome_high",
    "family_p_outcome",
]


def short_horizon_outcomes(
    corpus: Corpus,
    *,
    horizon: float = DEFAULT_HORIZON,
    prior_strength: float = 2.0,
    family_prior_strength: float = 1.0,
    credible_mass: float = 0.9,
) -> pd.DataFrame:
    """P(any Score Event or submission finish, for either Athlete, soon after entering a Position).

    "Soon" is within `horizon` seconds (default 30s) of entering, or before
    the next Reset (see `short_horizon_entries`). One row per Position.

    `entries` / `entries_with_outcome` / `observed_share` are the raw counts.
    The estimate treats Matches as clusters: each Match weighs 1 per
    Position, shared equally among its entries, so a Match with many
    re-entries can't fake confidence. With k = the summed weight of entries
    with an outcome and n = the summed weight of all entries (`weight`, one
    per Match), and k_F, n_F the same over the other Positions in its Family
    (leave-one-out: the Position's own entries are not in k_F, n_F):

        f       = (k_F + β / 2) / (n_F + β)              the rest of the Family's share
        p | data ~ Beta(k + α f, n - k + α (1 - f))

    where α is `prior_strength` and β is `family_prior_strength`. A Position
    with no other data in its Family (n_F = 0) gets f = 1/2, the plain
    uniform prior. `p_outcome` is the posterior mean, `p_outcome_low` / `p_outcome_high`
    bound its equal-tailed `credible_mass` (default 90%) credible interval
    and `family_p_outcome` is f.
    """
    if not 0 < credible_mass < 1:
        raise ValueError("credible_mass must be between 0 and 1")
    from scipy.stats import beta

    vocabulary = corpus.vocabulary
    entries = short_horizon_entries(corpus, horizon=horizon)
    entries["weight"] = 1 / entries.groupby(["annotation_id", "position_id"])["outcome"].transform("size")
    entries["outcome_weight"] = entries["weight"] * entries["outcome"]
    by_position = entries.groupby("position_id").agg(
        matches=("annotation_id", "nunique"),
        entries=("outcome", "size"),
        entries_with_outcome=("outcome", "sum"),
        weight=("weight", "sum"),
        outcome_weight=("outcome_weight", "sum"),
    )
    by_family = by_position.groupby(lambda p: vocabulary.family_of(p))[["weight", "outcome_weight"]].sum()

    tail = (1 - credible_mass) / 2
    rows = []
    for position_id, row in by_position.iterrows():
        family = vocabulary.family_of(position_id)
        # Leave the Position's own entries out of its Family prior, so they aren't counted twice.
        n_family = by_family.loc[family, "weight"] - row["weight"]
        k_family = by_family.loc[family, "outcome_weight"] - row["outcome_weight"]
        family_share = (k_family + family_prior_strength / 2) / (n_family + family_prior_strength)
        a = row["outcome_weight"] + prior_strength * family_share
        b = row["weight"] - row["outcome_weight"] + prior_strength * (1 - family_share)
        rows.append(
            {
                "position_id": position_id,
                "name": vocabulary.positions[position_id]["name"],
                "family": family,
                "matches": int(row["matches"]),
                "entries": int(row["entries"]),
                "entries_with_outcome": int(row["entries_with_outcome"]),
                "observed_share": row["entries_with_outcome"] / row["entries"],
                "weight": float(row["weight"]),
                "p_outcome": a / (a + b),
                "p_outcome_low": float(beta.ppf(tail, a, b)),
                "p_outcome_high": float(beta.ppf(1 - tail, a, b)),
                "family_p_outcome": family_share,
            }
        )
    return pd.DataFrame(rows, columns=OUTCOME_COLUMNS)


def _outcome_times(doc: dict) -> list[float]:
    """The times of every Score Event, plus the Match end for a submission win with no recorded finish."""
    scores = [event for event in doc.get("events", []) if event.get("kind") == "score"]
    times = [event["time"] for event in scores]
    finished = any(event["score_type"] == "submission_finish" for event in scores)
    if doc.get("result", {}).get("method") == "submission" and not finished:
        times.append(doc["match"]["end_offset"])
    return times
