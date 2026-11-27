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

New Athletes are added from the tool (below), which writes them to `vocab/athletes.json`, or to `ATHLETES_FILE` when set (format: `vocab/README.md`).

## Labelling a Match

1. Paste a YouTube URL, check the suggested Annotation id, enter your name and press **New Annotation**. Or pick a saved Annotation and press **Open**.
2. Seek to the referee's start and press **Set from playhead** for the Match start; do the same for the Match end.
3. Pick the two Athletes. If one isn't in the registry yet (e.g. a trials Athlete with no BJJ Heroes page), press **Add Athlete**, enter a display name, check the suggested slug and add any external links, then **Save Athlete**. Slugs are unique: a taken slug is refused. The new Athlete fills the first empty picker and is selectable straight away.
4. Play the Match and press a Position hotkey whenever a new Position is established (backdated to when it was first reached, per the Label Guide). The current Segment closes at the playhead and the new one runs until the next. The first Segment always starts at the Match start.
   A prompt then asks how the new Segment was reached: press the Transition type's key, then `1` or `2` for the Initiator, then `1` or `2` for the Athlete in the Position's first Role (e.g. the guard player). Symmetric Positions skip the Role holder, a Reset skips the Initiator, and the first Segment skips the Transition. `Esc` cancels; nothing changes until the last answer is in.
5. Fix mistakes on the timeline. Drag the handle between two Segments to retime that Transition. Click a Segment to jump the video to its start and open it in the Segment editor, where you can change its Position, Role holder and incoming Transition type and Initiator, or delete it (the previous or the next Segment absorbs its time). Undo with `z` and redo with `y`; undo covers every change to the Annotation.
6. Record scoring on its own track (ADR-0001). Press `p` when the referee awards points, an advantage or a penalty, at the tap (submission finish), or for a scored submission attempt where the ruleset scores one. The video pauses and the Score Event dialog opens at the playhead: pick the Athlete credited (for a penalty, the one penalised), the type (digits 1-5 in the Type list) and, for points, the value, then press Enter. Score Events show as markers on the track under the Segments, coloured by Athlete; click one to seek to it and edit or delete it. A marker outlined in red has a violation (e.g. it falls outside the Match).
7. Fill in the Match metadata (event, Bracket, round, ruleset, gi/no-gi, weight class, level, camera, resolution, licence / permission status) and the Result: the winner, or none for a draw, plus the Method. A submission win needs the final Score Event to be a submission finish credited to the winner, during a Submission Position they hold as attacker.
8. Save with **Save** or Ctrl+S. Work in progress saves fine even with violations (a missing Result, say); open violations are listed below the timeline. Click a Segment's violation to outline that Segment on the timeline and open it in the Segment editor.

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
| `server/` | The dev-server data API (`/api/...`) and JSON Schema checks. Saves are rejected unless they match `vocab/annotation.schema.json`; new Athletes (`POST /api/athletes`) unless the registry still matches `vocab/athletes.schema.json`. |
| `test/` | Session module tests, driven by command sequences. |
