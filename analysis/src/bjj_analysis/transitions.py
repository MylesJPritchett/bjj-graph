"""Earned Transitions and first-order next-Position distributions."""

from __future__ import annotations

import pandas as pd

from .corpus import Corpus
from .vocabulary import RESET

EARNED_TRANSITION_COLUMNS = [
    "annotation_id",
    "time",
    "from_position_id",
    "from_family",
    "to_position_id",
    "to_family",
    "transition_type",
    "initiator",
]


def earned_transitions(corpus: Corpus) -> pd.DataFrame:
    """One row per earned Transition: each boundary between adjacent Segments.

    A Reset is a path break, not an earned Transition: the Segments either
    side of it are not linked. A boundary with no recorded Transition (work
    in progress) is treated as a break too.
    """
    rows = []
    for annotation_id, segments in corpus.segments.groupby("annotation_id", sort=False):
        ordered = segments.sort_values("segment_index").to_dict("records")
        for before, after in zip(ordered, ordered[1:]):
            if after["transition_type"] in (None, RESET) or pd.isna(after["transition_type"]):
                continue
            rows.append(
                {
                    "annotation_id": annotation_id,
                    "time": after["start"],
                    "from_position_id": before["position_id"],
                    "from_family": before["family"],
                    "to_position_id": after["position_id"],
                    "to_family": after["family"],
                    "transition_type": after["transition_type"],
                    "initiator": after["initiator"],
                }
            )
    return pd.DataFrame(rows, columns=EARNED_TRANSITION_COLUMNS)


NEXT_POSITION_COLUMNS = [
    "position_id",
    "family",
    "next_position_id",
    "next_family",
    "count",
    "position_total",
    "family_count",
    "family_total",
    "observed_share",
    "probability",
]


def next_position_distribution(
    corpus: Corpus,
    *,
    prior_strength: float = 2.0,
    family_prior_strength: float = 1.0,
) -> pd.DataFrame:
    """First-order next-Position distribution for every Position, from earned Transitions.

    Counts are smoothed with a Dirichlet prior pooled by Family. For a
    Position p in Family F, with n_q earned Transitions from p to q (N in all),
    and m_q earned Transitions from any Position in F to q (M in all):

        f(q)       = (m_q + β / K) / (M + β)       the Family's smoothed distribution
        P(q | p)   = (n_q + α f(q)) / (N + α)

    where α is `prior_strength`, β is `family_prior_strength` and K is the
    number of Positions in the vocabulary. With α = 0 the probability is the
    observed share.

    One row per Position seen in the Corpus and each next Position reached
    from its Family, so a Position also lists next Positions it was never
    seen going to but its Family was (`count` 0). Next Positions never reached
    from the Family hold the small remaining mass and are left out, so the
    probabilities of a Position sum to slightly less than 1 when α > 0.
    `count`, `position_total`, `family_count` and `family_total` are the raw
    counts behind each estimate.
    """
    transitions = earned_transitions(corpus)
    vocabulary = corpus.vocabulary
    k = len(vocabulary.positions)

    counts = transitions.groupby(["from_position_id", "to_position_id"]).size()
    family_counts = transitions.groupby(["from_family", "to_position_id"]).size()

    rows = []
    for position_id in sorted(set(corpus.segments["position_id"])):
        family = vocabulary.family_of(position_id)
        if family not in family_counts.index.get_level_values(0):
            continue
        targets = family_counts.loc[family]
        family_total = int(targets.sum())
        own = counts.loc[position_id] if position_id in counts.index.get_level_values(0) else pd.Series(dtype=int)
        position_total = int(own.sum())
        for next_position_id, family_count in targets.items():
            count = int(own.get(next_position_id, 0))
            family_share = (family_count + family_prior_strength / k) / (family_total + family_prior_strength)
            denominator = position_total + prior_strength
            rows.append(
                {
                    "position_id": position_id,
                    "family": family,
                    "next_position_id": next_position_id,
                    "next_family": vocabulary.family_of(next_position_id),
                    "count": count,
                    "position_total": position_total,
                    "family_count": int(family_count),
                    "family_total": family_total,
                    "observed_share": count / position_total if position_total else float("nan"),
                    "probability": (count + prior_strength * family_share) / denominator
                    if denominator
                    else float("nan"),
                }
            )
    table = pd.DataFrame(rows, columns=NEXT_POSITION_COLUMNS)
    return table.sort_values(
        ["position_id", "probability", "next_position_id"], ascending=[True, False, True]
    ).reset_index(drop=True)


NEXT_POSITION_TRANSITION_COLUMNS = [
    "position_id",
    "next_position_id",
    "transition_type",
    "count",
    "share",
]


def next_position_transitions(corpus: Corpus) -> pd.DataFrame:
    """The Transition types that lead from each Position to each next Position.

    One row per (Position, next Position, Transition type) with its earned
    count, and `share`: the fraction of that Position-to-next-Position count
    made by this Transition type. Resets never appear.
    """
    transitions = earned_transitions(corpus).rename(
        columns={"from_position_id": "position_id", "to_position_id": "next_position_id"}
    )
    table = (
        transitions.groupby(["position_id", "next_position_id", "transition_type"])
        .size()
        .rename("count")
        .reset_index()
    )
    table["share"] = table["count"] / table.groupby(["position_id", "next_position_id"])["count"].transform("sum")
    return table.sort_values(
        ["position_id", "next_position_id", "count", "transition_type"],
        ascending=[True, True, False, True],
    ).reset_index(drop=True)[NEXT_POSITION_TRANSITION_COLUMNS]
