"""The shared vocabulary (Positions, Families, Transition types) from vocab/."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: vocab/ at the repo root, next to analysis/.
DEFAULT_VOCAB_DIR = Path(__file__).resolve().parents[3] / "vocab"

#: The Transition type imposed by the referee. A Reset is a path break, never
#: an earned Transition.
RESET = "reset"


@dataclass(frozen=True)
class Vocabulary:
    version: str
    families: dict[str, dict[str, Any]]
    positions: dict[str, dict[str, Any]]
    transitions: dict[str, dict[str, Any]]

    def family_of(self, position_id: str) -> str:
        return self.positions[position_id]["family"]

    def is_symmetric(self, position_id: str) -> bool:
        return self.positions[position_id]["symmetric"]


def load_vocabulary(vocab_dir: Path | str = DEFAULT_VOCAB_DIR) -> Vocabulary:
    data = json.loads((Path(vocab_dir) / "vocabulary.json").read_text())
    return Vocabulary(
        version=data["version"],
        families={f["id"]: f for f in data["families"]},
        positions={p["id"]: p for p in data["positions"]},
        transitions={t["id"]: t for t in data["transitions"]},
    )


def load_annotation_schema(vocab_dir: Path | str = DEFAULT_VOCAB_DIR) -> dict[str, Any]:
    return json.loads((Path(vocab_dir) / "annotation.schema.json").read_text())
