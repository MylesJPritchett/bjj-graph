"""Builders for tiny synthetic Corpora, written to a temporary directory.

Every test (and every later analysis) builds its Corpus with these, so the
expected numbers can be worked out by hand from the test itself.

    a = (
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("closed_guard", 30, holder=B, via="guard_pull", by=B)
        .result(winner=A, method="points")
    )
    corpus_dir = write_corpus(tmp_path, a)

Segments are given by duration and laid end to end from the Match start, so
they always tile the Match.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

A = "athlete-a"
B = "athlete-b"


class AnnotationBuilder:
    def __init__(
        self,
        annotation_id: str,
        *,
        athletes: tuple[str, str] = (A, B),
        start: float = 0,
        **metadata: Any,
    ) -> None:
        self._doc: dict[str, Any] = {
            "id": annotation_id,
            "schema_version": 1,
            "vocabulary_version": "0.1.0",
            "annotator": "synthetic",
            "source": {
                "platform": "youtube",
                "video_id": f"SYNTH-{annotation_id}",
                "licence_status": "own-footage",
            },
            "match": {"start_offset": start, "end_offset": start},
            "metadata": {
                "event": "Synthetic Open",
                "bracket": "men -77kg",
                "ruleset": "adcc",
                "gi": False,
                "weight_class": "-77kg",
                "level": "elite",
                **metadata,
            },
            "athletes": list(athletes),
            "segments": [],
            "events": [],
        }

    def segment(
        self,
        position_id: str,
        duration: float,
        *,
        holder: str | None = None,
        via: str | None = None,
        by: str | None = None,
    ) -> AnnotationBuilder:
        """Append a Segment of `position_id` lasting `duration` seconds.

        `holder` is the first Role holder (asymmetric Positions), `via` the
        incoming Transition type and `by` its Initiator. The first Segment
        normally has no `via`; later ones default to `via="other"` if omitted
        so the Annotation stays complete.
        """
        start = self._doc["match"]["end_offset"]
        segment: dict[str, Any] = {
            "start": start,
            "end": start + duration,
            "position_id": position_id,
        }
        if holder is not None:
            segment["first_role_holder"] = holder
        if self._doc["segments"]:
            entered_by: dict[str, Any] = {"transition_type": via or "other"}
            if by is not None:
                entered_by["initiator"] = by
            segment["entered_by"] = entered_by
        elif via is not None:
            raise ValueError("the first Segment has no incoming Transition")
        self._doc["segments"].append(segment)
        self._doc["match"]["end_offset"] = start + duration
        return self

    def reset(self, position_id: str = "standing", duration: float = 10) -> AnnotationBuilder:
        """Append a Segment entered by a referee Reset (no Initiator)."""
        return self.segment(position_id, duration, via="reset")

    def score(
        self,
        time: float,
        athlete: str,
        score_type: str = "points",
        value: float | None = None,
    ) -> AnnotationBuilder:
        event: dict[str, Any] = {
            "kind": "score",
            "time": time,
            "athlete": athlete,
            "score_type": score_type,
        }
        if value is not None:
            event["value"] = value
        self._doc["events"].append(event)
        return self

    def result(self, winner: str | None = None, method: str = "points") -> AnnotationBuilder:
        result: dict[str, Any] = {"method": method}
        if winner is not None:
            result["winner"] = winner
        self._doc["result"] = result
        return self

    def relabel_of(self, original_id: str) -> AnnotationBuilder:
        self._doc["relabel_of"] = original_id
        return self

    def build(self) -> dict[str, Any]:
        return copy.deepcopy(self._doc)


def write_corpus(directory: Path, *annotations: AnnotationBuilder | dict[str, Any]) -> Path:
    """Write each Annotation to `directory/<id>.json` and return `directory`."""
    directory.mkdir(parents=True, exist_ok=True)
    for annotation in annotations:
        doc = annotation.build() if isinstance(annotation, AnnotationBuilder) else annotation
        (directory / f"{doc['id']}.json").write_text(json.dumps(doc, indent=2))
    return directory


def write_raw(directory: Path, filename: str, text: str) -> Path:
    """Write an arbitrary (possibly malformed) file into the Corpus directory."""
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    path.write_text(text)
    return path
