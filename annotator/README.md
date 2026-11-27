# Annotator

The local annotation tool: plays a Match through the YouTube embed player and records its Annotation, mostly from the keyboard. Each Annotation is saved as `annotations/<id>.json` at the repo root. No video is stored (ADR-0002).

## Running it

```
cd annotator
npm install
npm run dev        # opens the tool at http://localhost:5173
npm test           # session module tests
npm run typecheck
```

To try it without touching the real data, point the dev server at the fictional sample registry and a scratch folder:

```
ATHLETES_FILE=../vocab/examples/sample-athletes.json ANNOTATIONS_DIR=/tmp/annotations npm run dev
```

Until the tool can add Athletes itself, add them to `vocab/athletes.json` by hand (format: `vocab/README.md`).

## Labelling a Match

1. Paste a YouTube URL, check the suggested Annotation id, enter your name and press **New Annotation**. Or pick a saved Annotation and press **Open**.
2. Seek to the referee's start and press **Set from playhead** for the Match start; do the same for the Match end.
3. Pick the two Athletes.
4. Play the Match and press a Position hotkey whenever a new Position is established (backdated to when it was first reached, per the Label Guide). The current Segment closes at the playhead and the new one runs until the next. The first Segment always starts at the Match start.
5. Save with **Save** or Ctrl+S. Work in progress saves fine; open violations are listed below the timeline.

Playback keys: `k` or Space play/pause, `←` `→` 1s, `j` `l` 5s, `,` `.` one frame, `[` `]` speed. The full key legend, including every Position hotkey, is shown beside the player.

## Re-labelling a Match blind

To check your own consistency, re-label about 10% of Matches at least a week after the first pass. Pick the saved Annotation, enter your name and press **Start re-label**. The tool creates `<id>-relabel` (or `-relabel-2` and so on), linked to the original by `relabel_of`. It copies the source, Match bounds, metadata and Athletes, and none of the original's Segments, Score Events or Result. The original's labels are never shown. Label it as usual, then save. The analysis leaves re-labels out of the main statistics and compares each one with its original (`agreement_report` in `analysis/`).

## Layout

| Path | What it is |
| --- | --- |
| `src/session/` | The annotation session module: pure TypeScript, no DOM. Commands in, Annotation and violations out. |
| `src/session/commands/` | One file per command area. Register new commands in `commands/index.ts`. |
| `src/session/relabel.ts` | Starting a blind re-label from a saved Annotation. |
| `src/session/validation/` | One file per group of rules. Register new rules in `validation/index.ts`. |
| `src/ui/` | The thin UI shell: `player/`, `timeline/`, `panels/`, the keyboard map and the store. |
| `server/` | The dev-server data API (`/api/...`) and JSON Schema checks. Saves are rejected unless they match `vocab/annotation.schema.json`. |
| `test/` | Session module tests, driven by command sequences. |
