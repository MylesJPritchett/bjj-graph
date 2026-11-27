"""Self-consistency: how well each blind re-label agrees with its original Annotation.

A re-label is an Annotation with `relabel_of` set to the id of the original
Annotation of the same Match. Load the Corpus with `include_relabels=True`
to compare them; the main statistics leave re-labels out by default.

From the command line, over every pair in a Corpus directory (the
`bjj-agreement` script is installed with the package):

    .venv/bin/bjj-agreement annotations/
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from .corpus import Corpus, load_corpus
from .vocabulary import Vocabulary

PAIR_COLUMNS = [
    "original_id",
    "relabel_id",
    "match_time",
    "position_agreement",
    "family_agreement",
    "role_holder_agreement",
    "transitions_original",
    "transitions_relabel",
    "transition_edit_distance",
    "transition_alignment",
]

POSITION_COLUMNS = [
    "position_id",
    "family",
    "pairs",
    "time",
    "disagreement_time",
    "role_holder_disagreement_time",
    "disagreement_share",
]

TRANSITION_COLUMNS = ["transition_type", "pairs", "occurrences", "disagreements", "disagreement_share"]

CONFUSION_COLUMNS = ["original_position_id", "relabel_position_id", "pairs", "time"]

UNPAIRED_COLUMNS = ["relabel_id", "relabel_of", "reason"]


@dataclass(frozen=True)
class AgreementReport:
    """Agreement between every original/re-label pair in a Corpus.

    - `pairs`: one row per pair. The three time shares are fractions of the
      original's Match time where both versions give the same Family, the same
      Position, and the same Position with the same Role holder. Time either
      version leaves unlabelled counts as disagreement. `transition_alignment`
      is 1 - edit distance / longer sequence length over the two sequences of
      Transition types, in Match order (1 when both are empty).
    - `positions`: the disagreement ranking by Position, most disagreement
      first. `time` is the Match time either version gives the Position;
      `disagreement_time` is the part of it where the versions differ in
      Position or Role holder (`role_holder_disagreement_time` is the part
      where they give the same Position but different Role holders).
    - `transitions`: the disagreement ranking by Transition type, from the
      edit-distance alignment. `occurrences` counts the type in both versions;
      `disagreements` counts the alignment edits involving it (a substitution
      counts against both types).
    - `confusions`: Match time where the original gives one Position and the
      re-label another, largest first.
    - `unpaired`: re-labels that couldn't be compared, with the reason.
    """

    pairs: pd.DataFrame
    positions: pd.DataFrame
    transitions: pd.DataFrame
    confusions: pd.DataFrame
    unpaired: pd.DataFrame


def agreement_report(corpus: Corpus) -> AgreementReport:
    """Compare every re-label in `corpus` with its original Annotation.

    Load the Corpus with `include_relabels=True`, or there are no re-labels to
    compare. A re-label whose original isn't in the Corpus (missing, rejected
    or filtered out), or whose original has no Match bounds, is listed in
    `unpaired` instead.
    """
    by_id = {doc["id"]: doc for doc in corpus.annotations}
    vocabulary = corpus.vocabulary
    pairs, unpaired = [], []
    position_stats: dict[str, dict[str, Any]] = defaultdict(_new_stats)
    transition_stats: dict[str, dict[str, Any]] = defaultdict(_new_stats)
    confusions: dict[tuple[str | None, str | None], dict[str, Any]] = defaultdict(_new_stats)

    for relabel in corpus.annotations:
        original_id = relabel.get("relabel_of")
        if original_id is None:
            continue
        original = by_id.get(original_id)
        if original is None:
            unpaired.append(_unpaired(relabel, "the original isn't in the Corpus"))
            continue
        if "match" not in original:
            unpaired.append(_unpaired(relabel, "the original has no Match bounds"))
            continue
        pair = (original_id, relabel["id"])
        timeline = _compare_timelines(original, relabel, vocabulary, pair, position_stats, confusions)
        sequences = _compare_transitions(original, relabel, pair, transition_stats)
        pairs.append({"original_id": original_id, "relabel_id": relabel["id"], **timeline, **sequences})

    return AgreementReport(
        pairs=pd.DataFrame(pairs, columns=PAIR_COLUMNS),
        positions=_position_table(position_stats, vocabulary),
        transitions=_transition_table(transition_stats),
        confusions=_confusion_table(confusions),
        unpaired=pd.DataFrame(unpaired, columns=UNPAIRED_COLUMNS),
    )


def _new_stats() -> dict[str, Any]:
    return {"pairs": set(), "time": 0.0, "disagreement_time": 0.0, "role_holder_disagreement_time": 0.0,
            "occurrences": 0, "disagreements": 0}


def _unpaired(relabel: dict[str, Any], reason: str) -> dict[str, str]:
    return {"relabel_id": relabel["id"], "relabel_of": relabel["relabel_of"], "reason": reason}


# ---- Timeline agreement ----


def _label_at(segments: list[dict[str, Any]], time: float) -> tuple[str | None, str | None]:
    """The (Position, first Role holder) labelled at `time`, or (None, None) if unlabelled."""
    for segment in segments:
        if segment["start"] <= time < segment["end"]:
            return segment["position_id"], segment.get("first_role_holder")
    return None, None


def _compare_timelines(
    original: dict[str, Any],
    relabel: dict[str, Any],
    vocabulary: Vocabulary,
    pair: tuple[str, str],
    position_stats: dict[str, dict[str, Any]],
    confusions: dict[tuple[str | None, str | None], dict[str, Any]],
) -> dict[str, float]:
    start, end = original["match"]["start_offset"], original["match"]["end_offset"]
    cuts = {start, end}
    for segment in original["segments"] + relabel["segments"]:
        cuts.update(t for t in (segment["start"], segment["end"]) if start < t < end)
    cuts = sorted(cuts)

    same_family = same_position = same_holder = 0.0
    for left, right in zip(cuts, cuts[1:]):
        span, middle = right - left, (left + right) / 2
        position_o, holder_o = _label_at(original["segments"], middle)
        position_r, holder_r = _label_at(relabel["segments"], middle)
        family_o = vocabulary.family_of(position_o) if position_o else None
        family_r = vocabulary.family_of(position_r) if position_r else None
        positions_agree = position_o is not None and position_o == position_r
        holders_agree = positions_agree and holder_o == holder_r

        same_family += span if family_o is not None and family_o == family_r else 0
        same_position += span if positions_agree else 0
        same_holder += span if holders_agree else 0

        for position_id in {position_o, position_r} - {None}:
            stats = position_stats[position_id]
            stats["pairs"].add(pair)
            stats["time"] += span
            if not holders_agree:
                stats["disagreement_time"] += span
            if positions_agree and not holders_agree:
                stats["role_holder_disagreement_time"] += span
        if not positions_agree:
            confusion = confusions[(position_o, position_r)]
            confusion["pairs"].add(pair)
            confusion["time"] += span

    match_time = end - start
    share = (lambda t: t / match_time) if match_time > 0 else (lambda t: float("nan"))
    return {
        "match_time": match_time,
        "position_agreement": share(same_position),
        "family_agreement": share(same_family),
        "role_holder_agreement": share(same_holder),
    }


# ---- Transition sequence alignment ----


def _transition_sequence(annotation: dict[str, Any]) -> list[str]:
    """The Transition types between Segments, in Match order (Resets included)."""
    return [s["entered_by"]["transition_type"] for s in annotation["segments"] if "entered_by" in s]


def _alignment_edits(a: Sequence[str], b: Sequence[str]) -> list[tuple[str | None, str | None]]:
    """A minimal Levenshtein alignment of `a` and `b`, as its edits.

    Each edit is (a item, b item): a substitution has both, a deletion has no
    b item and an insertion has no a item. Matching items are not listed.
    """
    rows, cols = len(a) + 1, len(b) + 1
    cost = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        cost[i][0] = i
    for j in range(cols):
        cost[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost[i][j] = min(
                cost[i - 1][j - 1] + (a[i - 1] != b[j - 1]),
                cost[i - 1][j] + 1,
                cost[i][j - 1] + 1,
            )

    edits = []
    i, j = len(a), len(b)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and cost[i][j] == cost[i - 1][j - 1] + (a[i - 1] != b[j - 1]):
            if a[i - 1] != b[j - 1]:
                edits.append((a[i - 1], b[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and cost[i][j] == cost[i - 1][j] + 1:
            edits.append((a[i - 1], None))
            i -= 1
        else:
            edits.append((None, b[j - 1]))
            j -= 1
    return edits[::-1]


def _compare_transitions(
    original: dict[str, Any],
    relabel: dict[str, Any],
    pair: tuple[str, str],
    transition_stats: dict[str, dict[str, Any]],
) -> dict[str, float]:
    sequence_o, sequence_r = _transition_sequence(original), _transition_sequence(relabel)
    edits = _alignment_edits(sequence_o, sequence_r)

    for transition_type, count in Counter(sequence_o + sequence_r).items():
        stats = transition_stats[transition_type]
        stats["pairs"].add(pair)
        stats["occurrences"] += count
    for edit in edits:
        for transition_type in edit:
            if transition_type is not None:
                transition_stats[transition_type]["disagreements"] += 1

    longer = max(len(sequence_o), len(sequence_r))
    return {
        "transitions_original": len(sequence_o),
        "transitions_relabel": len(sequence_r),
        "transition_edit_distance": len(edits),
        "transition_alignment": 1 - len(edits) / longer if longer else 1.0,
    }


# ---- Tables ----


def _position_table(stats: dict[str, dict[str, Any]], vocabulary: Vocabulary) -> pd.DataFrame:
    rows = [
        {
            "position_id": position_id,
            "family": vocabulary.family_of(position_id),
            "pairs": len(s["pairs"]),
            "time": s["time"],
            "disagreement_time": s["disagreement_time"],
            "role_holder_disagreement_time": s["role_holder_disagreement_time"],
            "disagreement_share": s["disagreement_time"] / s["time"] if s["time"] else float("nan"),
        }
        for position_id, s in stats.items()
    ]
    table = pd.DataFrame(rows, columns=POSITION_COLUMNS)
    return table.sort_values(
        ["disagreement_time", "disagreement_share", "position_id"], ascending=[False, False, True]
    ).reset_index(drop=True)


def _transition_table(stats: dict[str, dict[str, Any]]) -> pd.DataFrame:
    rows = [
        {
            "transition_type": transition_type,
            "pairs": len(s["pairs"]),
            "occurrences": s["occurrences"],
            "disagreements": s["disagreements"],
            "disagreement_share": s["disagreements"] / s["occurrences"],
        }
        for transition_type, s in stats.items()
    ]
    table = pd.DataFrame(rows, columns=TRANSITION_COLUMNS)
    return table.sort_values(
        ["disagreements", "disagreement_share", "transition_type"], ascending=[False, False, True]
    ).reset_index(drop=True)


def _confusion_table(stats: dict[tuple[str | None, str | None], dict[str, Any]]) -> pd.DataFrame:
    rows = [
        {"original_position_id": o, "relabel_position_id": r, "pairs": len(s["pairs"]), "time": s["time"]}
        for (o, r), s in stats.items()
    ]
    table = pd.DataFrame(rows, columns=CONFUSION_COLUMNS)
    return table.sort_values(
        ["time", "original_position_id", "relabel_position_id"], ascending=[False, True, True], na_position="last"
    ).reset_index(drop=True)


# ---- Command line ----


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="bjj-agreement",
        description="Agreement between every blind re-label and its original Annotation.",
    )
    parser.add_argument("corpus_dir", type=Path, help="the Corpus directory, e.g. annotations/")
    args = parser.parse_args(argv)

    report = agreement_report(load_corpus(args.corpus_dir, include_relabels=True))
    sections = [
        ("Agreement per pair", report.pairs),
        ("Positions with the most disagreement", report.positions),
        ("Transition types with the most disagreement", report.transitions),
        ("Position confusions (original -> re-label)", report.confusions),
        ("Re-labels that couldn't be compared", report.unpaired),
    ]
    with pd.option_context("display.width", 200, "display.max_columns", None, "display.max_rows", None):
        for title, table in sections:
            print(f"\n{title}\n{'-' * len(title)}")
            print(table.round(3).to_string(index=False) if not table.empty else "(none)")
    return 0
