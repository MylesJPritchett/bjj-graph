"""Retention: how long a Position is held, and whether it is left for something better or worse."""

from __future__ import annotations

import pandas as pd

from .corpus import Corpus
from .positional_eval import INITIATOR, OPPONENT, SECOND_ROLE, perspective_holder, positional_eval_by_perspective
from .vocabulary import RESET

#: How a Segment ends.
EARNED = "earned"
MATCH_END = "match_end"

#: The judgement of an earned exit, from the holder's side.
BETTER = "better"
WORSE = "worse"
NEUTRAL = "neutral"

EXIT_COLUMNS = [
    "annotation_id",
    "segment_index",
    "time",
    "position_id",
    "next_position_id",
    "exit",
    "transition_type",
    "holder",
    "perspective",
    "next_perspective",
    "p_win",
    "p_win_low",
    "p_win_high",
    "next_p_win",
    "next_p_win_low",
    "next_p_win_high",
    "judgement",
]


def retention_exits(corpus: Corpus, **eval_options) -> pd.DataFrame:
    """One row per Segment: how it ended and, for an earned exit, whether that was better or worse.

    `exit` is `earned` (an earned Transition into the next Segment), `reset`
    (a referee Reset, a path break) or `match_end`. The holder is the Athlete
    the Position's headline Positional Eval is about: the first Role holder
    of an asymmetric Position, the Initiator of a symmetric one.

    An earned exit is judged from the holder's side. `p_win*` is the
    holder's Positional Eval in the Position left and `next_p_win*` their Eval
    in the Position entered, from whichever perspective they hold there
    (first or second Role; Initiator or opponent). The exit is `better` if
    the next credible interval lies wholly above the current one, `worse` if
    wholly below, and `neutral` if the intervals overlap. Exits with no
    holder (a symmetric Position entered by a Reset or at the Match start),
    a missing Role holder or Initiator, or no recorded Transition type are
    left unjudged (`judgement` empty).

    `eval_options` go to `positional_eval_by_perspective` (cap, prior
    strengths, credible mass).
    """
    evals = positional_eval_by_perspective(corpus, **eval_options).set_index(["position_id", "perspective"])
    rows = []
    for annotation_id, ordered in corpus.segments_by_annotation():
        for segment, following in zip(ordered, [*ordered[1:], None]):
            holder, perspective = perspective_holder(segment)
            row = {
                "annotation_id": annotation_id,
                "segment_index": segment["segment_index"],
                "time": segment["end"],
                "position_id": segment["position_id"],
                "next_position_id": None,
                "exit": MATCH_END,
                "transition_type": None,
                "holder": holder,
                "perspective": perspective,
                "next_perspective": None,
                "judgement": None,
            }
            row.update(_eval_columns(evals, segment["position_id"], perspective, prefix=""))
            if following is not None:
                transition_type = following["transition_type"]
                if pd.isna(transition_type):
                    transition_type = None
                row["next_position_id"] = following["position_id"]
                row["transition_type"] = transition_type
                row["exit"] = RESET if transition_type == RESET else EARNED
                if row["exit"] == EARNED and transition_type is not None and holder is not None:
                    next_perspective = _perspective_of(holder, following)
                    row["next_perspective"] = next_perspective
                    row.update(_eval_columns(evals, following["position_id"], next_perspective, prefix="next_"))
                    row["judgement"] = _judge(row)
            rows.append(row)
    return pd.DataFrame(rows, columns=EXIT_COLUMNS)


RETENTION_COLUMNS = [
    "position_id",
    "name",
    "family",
    "role",
    "matches",
    "segments",
    "median_hold",
    "total_hold",
    "exits",
    "better",
    "worse",
    "neutral",
    "unjudged",
    "p_better",
    "p_worse",
    "p_neutral",
    "resets",
    "match_ends",
]


def retention(corpus: Corpus, **eval_options) -> pd.DataFrame:
    """The Retention of every Position seen in the Corpus, one row each.

    - `median_hold` is the median Segment duration in seconds and
      `total_hold` their sum, over `segments` Segments in `matches` Matches.
    - `role` is the holder's Role (the first Role; empty for a symmetric
      Position, whose holder is the Initiator).
    - `exits` counts earned exits, split into `better` / `worse` /
      `neutral` (see `retention_exits` for how each is judged) and
      `unjudged`. `p_better` / `p_worse` / `p_neutral` are shares of the
      judged exits (empty when none were judged).
    - `resets` and `match_ends` count Segments ended by a Reset or by the
      end of the Match: neither is an exit the holder chose.

    `eval_options` go to `positional_eval_by_perspective`.
    """
    vocabulary = corpus.vocabulary
    exits = retention_exits(corpus, **eval_options)
    rows = []
    for position_id, segments in corpus.segments.groupby("position_id", sort=True):
        roles = vocabulary.positions[position_id].get("roles") or [None]
        ends = exits[exits["position_id"] == position_id]
        earned = ends[ends["exit"] == EARNED]
        judged = earned["judgement"].value_counts()
        counts = {kind: int(judged.get(kind, 0)) for kind in (BETTER, WORSE, NEUTRAL)}
        total = sum(counts.values())
        rows.append(
            {
                "position_id": position_id,
                "name": vocabulary.positions[position_id]["name"],
                "family": vocabulary.family_of(position_id),
                "role": roles[0],
                "matches": segments["annotation_id"].nunique(),
                "segments": len(segments),
                "median_hold": float(segments["duration"].median()),
                "total_hold": float(segments["duration"].sum()),
                "exits": len(earned),
                **counts,
                "unjudged": len(earned) - total,
                **{f"p_{kind}": count / total if total else float("nan") for kind, count in counts.items()},
                "resets": int((ends["exit"] == RESET).sum()),
                "match_ends": int((ends["exit"] == MATCH_END).sum()),
            }
        )
    return pd.DataFrame(rows, columns=RETENTION_COLUMNS)


def _perspective_of(athlete: str, segment: dict) -> str | None:
    """The perspective `athlete` holds in `segment`, or None if it isn't recorded."""
    holder, headline = perspective_holder(segment)
    if holder is None:
        return None
    if holder == athlete:
        return headline
    return OPPONENT if headline == INITIATOR else SECOND_ROLE


def _eval_columns(evals: pd.DataFrame, position_id: str, perspective: str | None, *, prefix: str) -> dict:
    names = ("p_win", "p_win_low", "p_win_high")
    if perspective is None or (position_id, perspective) not in evals.index:
        return {f"{prefix}{name}": float("nan") for name in names}
    row = evals.loc[(position_id, perspective)]
    return {f"{prefix}{name}": float(row[name]) for name in names}


def _judge(row: dict) -> str | None:
    if pd.isna(row["p_win"]) or pd.isna(row["next_p_win"]):
        return None
    if row["next_p_win_low"] > row["p_win_high"]:
        return BETTER
    if row["next_p_win_high"] < row["p_win_low"]:
        return WORSE
    return NEUTRAL
