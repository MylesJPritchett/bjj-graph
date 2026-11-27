# bjj-graph

A statistics database of how elite no-gi grappling Matches move through Positions. I label Matches from published footage with a local, keyboard-driven tool: which Position each Athlete was in, how they got there, and who scored. The analysis then answers the questions coaches usually answer from memory: from here, what usually happens next, and how often does being here win the Match?

Each Match is a path through one shared graph. Positions are the nodes and Transitions are the edges. Combined across a whole Corpus, those paths give real transition frequencies and a **Positional Eval** for every Position. The Positional Eval is like a chess engine's evaluation bar, but for grappling: the chance that the Athlete holding the Position goes on to win, lose or draw.

<!--
  SCREENSHOT: record a GIF of the annotator labelling ~20 seconds of a Match: a Position
  hotkey, the Transition / Initiator / Role holder prompt, the Segment appearing on the
  timeline, then a Score Event with `p`. Save as docs/annotator.gif and replace this comment with:
  ![Labelling a Match in the annotator](docs/annotator.gif)

  A second image of the network graph coloured by Positional Eval (from the notebook)
  would go well under "What it does".
-->

**Status:** the tool and the analysis are built and tested, but no Matches have been labelled yet. The first Corpus will be the ADCC 2022 men's -88kg Bracket (16 Matches); see [the research note](docs/research/first-bracket.md). Until then, the notebook runs on a fictional sample Match.

## What it does

**Annotator** (local web app)

- Plays a Match through the YouTube embed player. No video is ever downloaded or stored.
- One hotkey per Position: pressing it closes the current Segment at the playhead and starts a new one. A short keyboard prompt then records the Transition type, the Initiator and which Athlete holds the first Role, skipping any question that doesn't apply.
- The timeline covers the whole Match with Segments and no gaps. Drag a boundary to retime a Transition, click a Segment to edit or delete it, and undo/redo any change.
- Score Events (points, advantages, penalties, submission finishes) go on their own track. Forms record the Match metadata and the Result with its Method.
- Live validation flags:
  - gaps in the timeline, and Segments under 3s;
  - a missing Role holder, or one on a symmetric Position;
  - an Initiator on a Reset;
  - a Score Event outside the Match;
  - a submission win with no matching finish.
- Adds new Athletes to a shared registry, so the same Athlete has the same id in every Match.
- Blind re-labelling: starts a fresh copy of a saved Match without showing the original labels, so I can measure my own consistency.
- Saves one JSON file per Match into `annotations/`, versioned in git.

**Analysis** (Python package and notebook)

- **Positional Eval:** for every Position, P(win / loss / draw) from the holder's perspective, with 90% credible intervals.
- **Retention:** how long each Position is held, and whether it's left for a better, worse or neutral Position.
- **Payoff:** how often entering a Position leads to any score or submission within 30s.
- **Next-Position distributions:** where each Position goes next, and the Transition types that get there.
- **Network graph:** of the whole Corpus, with nodes coloured by Positional Eval and edges sized by frequency.
- **Agreement report:** compares each blind re-label with its original, so I can see where the Label Guide needs tightening.
- **Sanity check:** a comparison against the published figures in Lamas et al. 2024.

## How it works

```text
YouTube embed ──▶ annotation session ──▶ annotations/<id>.json ──▶ load_corpus ──▶ Eval / Retention / Payoff / …
  (annotator/)      commands in,           one file per Match        (analysis/)       tables + notebook
                    Annotation +           checked against
                    violations out         vocab/annotation.schema.json
```

The two halves share nothing but the Annotation file format and the vocabulary in `vocab/`: 27 Positions in 10 Families, and 13 Transition types, each with its Roles and hotkey. [`GLOSSARY.md`](GLOSSARY.md) defines every domain term, and the [Label Guide](docs/label-guide.md) sets out the rules for turning footage into an Annotation.

Some decisions worth calling out:

- **Positions don't carry scoring.** A pass is a Transition. The 3 points it earns is a separate Score Event, labelled under the Match's own ruleset. That keeps one Corpus comparable across rulesets that score the same Transition differently. ([ADR-0001](docs/adr/0001-ruleset-agnostic-positions-separate-score-track.md))
- **No video in the repo.** Annotations store only a video id and time offsets, and the tool plays footage through the embed player. Tournament footage is copyrighted; derived labels are much safer to publish. ([ADR-0002](docs/adr/0002-no-video-in-repo.md))
- **A Position only counts once it's held for 3s**, backdated to when it was first reached. Anything shorter folds into Scramble. Without this rule, the same footage gives a different path depending on how twitchy I am that day.
- **The Positional Eval weights each Segment by how long it's held, up to a cap.** Each Segment contributes `min(duration, 30s) / 30s`, summed per Match × Position × Athlete and capped at 1. So a 5s mount counts less than a 5-minute one, five quick re-entries can't count five times, and a long neutral stall can't dominate. The notebook re-runs the Eval at 15s, 30s and 60s caps to show how much the results depend on that choice.
- **Rare Positions borrow strength from their Family.** The Eval is a Dirichlet-multinomial pooled from Position to Family, and the Family prior leaves out the Position's own data. A Position seen in two Matches gets a sensible estimate with an honestly wide interval, not a falsely confident 100%.
- **Symmetric Positions are judged from the Initiator's side.** 50/50 is a coin flip by symmetry. "I pulled them into 50/50" is a different situation, though, and the Initiator is already recorded on every Transition.
- **The annotation session is a pure module.** Commands go in; the Annotation and its violations come out. Undo is a stack of snapshots, and the UI is a thin shell over it, so every labelling rule is unit-tested without a browser.

### Known limitations

- **Unconditional Eval.** The Positional Eval ignores the score, the clock and Athlete skill. Better Athletes reach better Positions, so some of the signal is really "what winners do". A Situational Eval that conditions on all of these is planned, not built.
- **No failed Attempts.** Failed sweeps and passes aren't recorded, because they're too hard to label consistently. Submission attempts are captured as Submission Positions.
- **Selection bias.** Only filmed, published events can be labelled. Labelling whole Brackets, rather than hand-picked Matches, reduces this but doesn't remove it.
- **Lamas et al. comparison.** It uses only the two figures from the paper's abstract, because the full text is paywalled.
- **Single annotator.** The agreement report measures my consistency with myself, not agreement between different people.

## Stack

- **Annotator:** TypeScript and Vite, using the YouTube IFrame API. A small Vite dev-server plugin reads and writes the JSON files, which are validated with Ajv. Tests run in Vitest.
- **Analysis:** Python, using pandas, NumPy, SciPy (Beta and Dirichlet intervals), networkx and matplotlib. Files are validated with jsonschema, tests run in pytest, and results are shown in a Jupyter notebook.
- **Shared:** JSON Schema (draft 2020-12) for the Annotation, vocabulary and Athlete registry formats.

## Getting started

Requires Node 24 and Python 3.12 or later.

**Annotator:**

```sh
cd annotator
npm install
npm run dev        # http://localhost:5173
```

To try it without touching real data, point it at the fictional sample registry and a scratch folder:

```sh
ATHLETES_FILE=../vocab/examples/sample-athletes.json ANNOTATIONS_DIR=/tmp/annotations npm run dev
```

The step-by-step labelling workflow and the full key map are in [`annotator/README.md`](annotator/README.md).

**Analysis:**

```sh
python3 -m venv .venv
.venv/bin/pip install -e "analysis[dev]" jupyterlab
.venv/bin/jupyter lab analysis/corpus-analysis.ipynb
```

The notebook reads `annotations/` and falls back to the sample Match while that folder is empty. To run the self-consistency report from the command line, use `.venv/bin/bjj-agreement annotations/`. [`analysis/README.md`](analysis/README.md) documents every function.

On NixOS, numpy needs a 64-bit `libstdc++.so.6`. Either set `LD_LIBRARY_PATH` to a `gcc-*-lib` store path's `lib/`, or enable `programs.nix-ld`.

## Testing

```sh
cd vocab && npm install && npm test             # vocabulary, schemas and the sample Annotation are valid
cd annotator && npm test && npm run typecheck   # annotation session: commands in, Annotation + violations out
cd analysis && ../.venv/bin/pytest              # analysis on small synthetic Corpora
```

The annotator tests drive the session module with realistic command sequences, then check the Annotation and violations it produces. For example: dragging a boundary so a Segment is under 3s flags that Segment, deleting a Segment keeps the timeline gap-free, and undo restores the exact previous document.

The analysis tests build tiny Corpora whose answers can be worked out by hand. For example: a 5s mount that loses and a 5-minute mount that wins make mount lean "win" for the holder, and five brief re-entries in one Match contribute no more than one solid hold.

## Licence

The code is [MIT](LICENSE). Annotations and vocabulary data are [CC BY 4.0](LICENSE-DATA).
