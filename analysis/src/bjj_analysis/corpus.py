"""Loading a Corpus directory of Annotations into plain tables."""

from __future__ import annotations

import json
from collections.abc import Collection, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from jsonschema import Draft202012Validator

from .vocabulary import DEFAULT_VOCAB_DIR, Vocabulary, load_annotation_schema, load_vocabulary

MATCH_COLUMNS = [
    "annotation_id",
    "file",
    "relabel_of",
    "annotator",
    "athlete_a",
    "athlete_b",
    "event",
    "bracket",
    "round",
    "ruleset",
    "gi",
    "weight_class",
    "level",
    "start_offset",
    "end_offset",
    "winner",
    "method",
]

SEGMENT_COLUMNS = [
    "annotation_id",
    "segment_index",
    "start",
    "end",
    "duration",
    "position_id",
    "family",
    "symmetric",
    "first_role_holder",
    "transition_type",
    "initiator",
]

REJECTED_COLUMNS = ["file", "errors"]

#: The Method of a Match with no winner.
DRAW = "draw"

#: One accepted value, or a collection of accepted values.
MetadataFilter = str | Collection[str] | None


@dataclass(frozen=True)
class Corpus:
    """A loaded Corpus.

    - `annotations`: the raw Annotation documents that were accepted.
    - `matches`: one row per Annotation (metadata, Athletes, Result).
    - `segments`: one row per Segment, in Match order, with its Family and its
      incoming Transition (`transition_type` / `initiator`, empty for the
      first Segment).
    - `rejected`: one row per file that failed to load, with the reasons.
    """

    annotations: list[dict[str, Any]]
    matches: pd.DataFrame
    segments: pd.DataFrame
    rejected: pd.DataFrame
    vocabulary: Vocabulary

    def segments_by_annotation(self) -> Iterator[tuple[str, list[dict[str, Any]]]]:
        """Each Annotation's id with its Segments as rows (dicts), in Match order."""
        for annotation_id, segments in self.segments.groupby("annotation_id", sort=False):
            yield annotation_id, segments.sort_values("segment_index").to_dict("records")


def load_corpus(
    directory: Path | str,
    *,
    ruleset: MetadataFilter = None,
    gi: bool | None = None,
    weight_class: MetadataFilter = None,
    event: MetadataFilter = None,
    bracket: MetadataFilter = None,
    include_relabels: bool = False,
    vocab_dir: Path | str = DEFAULT_VOCAB_DIR,
    pattern: str = "*.json",
) -> Corpus:
    """Load every Annotation file in `directory` that matches `pattern`.

    Each file is checked against vocab/annotation.schema.json and must use
    only Positions and Transition types from the vocabulary. Files that fail
    are left out and listed in `Corpus.rejected`.

    Metadata filters (`ruleset`, `gi`, `weight_class`, `event`, `bracket`)
    take one value or a collection of accepted values; `None` means no filter.
    An Annotation missing a filtered field is left out.

    Re-labels (Annotations with `relabel_of` set) are excluded unless
    `include_relabels` is true, so re-labelled Matches aren't counted twice.
    """
    filters = {
        key: value
        for key, value in {
            "ruleset": ruleset,
            "gi": gi,
            "weight_class": weight_class,
            "event": event,
            "bracket": bracket,
        }.items()
        if value is not None
    }
    vocabulary = load_vocabulary(vocab_dir)
    validator = Draft202012Validator(
        load_annotation_schema(vocab_dir), format_checker=Draft202012Validator.FORMAT_CHECKER
    )
    accepted: list[tuple[Path, dict[str, Any]]] = []
    rejected: list[dict[str, str]] = []
    for path in sorted(Path(directory).glob(pattern)):
        doc, errors = _read_annotation(path, validator, vocabulary)
        if errors:
            rejected.append({"file": path.name, "errors": "; ".join(errors)})
        elif _is_wanted(doc, filters, include_relabels):
            accepted.append((path, doc))

    return Corpus(
        annotations=[doc for _, doc in accepted],
        matches=pd.DataFrame(
            [_match_row(path, doc) for path, doc in accepted], columns=MATCH_COLUMNS
        ),
        segments=pd.DataFrame(
            [row for _, doc in accepted for row in _segment_rows(doc, vocabulary)],
            columns=SEGMENT_COLUMNS,
        ),
        rejected=pd.DataFrame(rejected, columns=REJECTED_COLUMNS),
        vocabulary=vocabulary,
    )


def _is_wanted(doc: dict[str, Any], filters: dict[str, Any], include_relabels: bool) -> bool:
    if "relabel_of" in doc and not include_relabels:
        return False
    metadata = doc["metadata"]
    for key, wanted in filters.items():
        if key not in metadata:
            return False
        accepted = wanted if isinstance(wanted, Collection) and not isinstance(wanted, str) else [wanted]
        if metadata[key] not in accepted:
            return False
    return True


def _read_annotation(
    path: Path, validator: Draft202012Validator, vocabulary: Vocabulary
) -> tuple[dict[str, Any] | None, list[str]]:
    """Parse and check one file. Returns the document, or the reasons it was rejected.

    Beyond the schema (structure only), the analysis needs every Position and
    Transition type to exist in the vocabulary, so unknown ids reject the file
    too. The annotation tool's completeness rules are not re-checked here.
    """
    try:
        doc = json.loads(path.read_text())
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        return None, [f"not valid JSON: {error}"]

    errors = [
        f"{'/'.join(str(p) for p in error.absolute_path) or '<root>'}: {error.message}"
        for error in sorted(validator.iter_errors(doc), key=lambda e: list(e.absolute_path))
    ]
    errors.extend(_result_errors(doc))
    if errors:
        return None, errors

    for index, segment in enumerate(doc["segments"]):
        if segment["position_id"] not in vocabulary.positions:
            errors.append(f"segments/{index}: unknown Position {segment['position_id']!r}")
        transition_type = segment.get("entered_by", {}).get("transition_type")
        if transition_type is not None and transition_type not in vocabulary.transitions:
            errors.append(f"segments/{index}: unknown Transition type {transition_type!r}")
    return doc, errors


def _result_errors(doc: Any) -> list[str]:
    """A Result's winner must agree with its Method: a draw has no winner, every other Method has one.

    The schema says so too; this is checked again here because the Positional
    Eval reads a missing winner as a draw.
    """
    result = doc.get("result") if isinstance(doc, dict) else None
    if not isinstance(result, dict) or "method" not in result:
        return []
    method, has_winner = result["method"], result.get("winner") is not None
    if method == DRAW and has_winner:
        return ["result: a draw has no winner"]
    if method != DRAW and not has_winner:
        return [f"result: Method {method!r} needs a winner"]
    return []


def _match_row(path: Path, doc: dict[str, Any]) -> dict[str, Any]:
    metadata = doc.get("metadata", {})
    athletes = doc.get("athletes", [])
    match = doc.get("match", {})
    result = doc.get("result", {})
    return {
        "annotation_id": doc["id"],
        "file": path.name,
        "relabel_of": doc.get("relabel_of"),
        "annotator": doc.get("annotator"),
        "athlete_a": athletes[0] if len(athletes) > 0 else None,
        "athlete_b": athletes[1] if len(athletes) > 1 else None,
        **{key: metadata.get(key) for key in ("event", "bracket", "round", "ruleset", "gi", "weight_class", "level")},
        "start_offset": match.get("start_offset"),
        "end_offset": match.get("end_offset"),
        "winner": result.get("winner"),
        "method": result.get("method"),
    }


def _segment_rows(doc: dict[str, Any], vocabulary: Vocabulary) -> list[dict[str, Any]]:
    rows = []
    for index, segment in enumerate(doc.get("segments", [])):
        entered_by = segment.get("entered_by", {})
        position_id = segment["position_id"]
        rows.append(
            {
                "annotation_id": doc["id"],
                "segment_index": index,
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["end"] - segment["start"],
                "position_id": position_id,
                "family": vocabulary.family_of(position_id),
                "symmetric": vocabulary.is_symmetric(position_id),
                "first_role_holder": segment.get("first_role_holder"),
                "transition_type": entered_by.get("transition_type"),
                "initiator": entered_by.get("initiator"),
            }
        )
    return rows
