# Shared vocabulary data

Plain JSON read by both the annotation tool (TypeScript) and the corpus analysis (Python). All schemas are JSON Schema draft 2020-12.

| File | What it is |
| --- | --- |
| `vocabulary.json` | Families, Positions and Transition types, with a `version`. Schema: `vocabulary.schema.json`. |
| `annotation.schema.json` | The Annotation format, one JSON document per Match, stored as `annotations/<id>.json`. |
| `athletes.json` | The Athlete registry: slug to display name plus optional external links. Schema: `athletes.schema.json`. |
| `examples/` | A hand-written, fictional sample Annotation and matching Athlete registry. Not part of any Corpus. |

How to label is in the [Label Guide](../docs/label-guide.md).

## Notes for readers of these files

- The Annotation schema checks **structure only**, so work in progress can be saved. `match`, `result`, Segments, Events and the second Athlete may be missing. The completeness and consistency rules (Segments tiling the Match, the 3s minimum, Role holder by symmetry, Initiator by `takes_initiator`, ids existing in the vocabulary and registry, Result present, the submission-finish rule) are applied on top by validation code.
- A Position's `roles` lists the first Role first. A Segment's `first_role_holder` is the Athlete in that first Role.
- Position `hotkey`s are unique among Positions; Transition `hotkey`s are unique among Transitions (they're for the separate Transition prompt). An uppercase letter means Shift plus that letter. No Position hotkey uses `j`, `k`, `l`, `y`, `z` or `p`, so those can be kept for playback, undo/redo and Score Events.
- Events are an open set of typed kinds. Schema version 1 has only `kind: "score"`.
- Annotations never contain video (ADR-0002): only a platform `video_id` and/or `url`, plus video-time offsets in seconds.

## Tests

```
cd vocab && npm install && npm test
```

## Licence

The data files here are CC BY 4.0 (see `LICENSE-DATA` at the repo root). The test code is MIT.
