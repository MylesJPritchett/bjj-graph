# Corpus analysis

The `bjj_analysis` Python package turns a Corpus of Annotations (`annotations/*.json`) into position statistics, and `corpus-analysis.ipynb` shows them. The notebook only calls the package and plots. Every number comes from functions tested on synthetic Corpora.

## Setup

From the repo root (Python 3.12 or later):

```
python3 -m venv .venv
.venv/bin/pip install -e "analysis[dev]"
```

Dependencies are pinned in `analysis/pyproject.toml`. The package reads `vocab/vocabulary.json` and `vocab/annotation.schema.json` from the repo, so install it editable (`-e`) from this checkout.

On NixOS, the numpy and pandas wheels need a 64-bit `libstdc++.so.6` on the library path: point `LD_LIBRARY_PATH` at the `lib/` directory of a `gcc-*-lib` store path, or enable `programs.nix-ld`.

## Running the tests

```
cd analysis
../.venv/bin/pytest
```

Tests build tiny synthetic Corpora in a temporary directory with `tests/corpus_builder.py`, so every expected value can be worked out by hand:

```python
from corpus_builder import A, B, AnnotationBuilder, write_corpus

write_corpus(
    tmp_path,
    AnnotationBuilder("m1", ruleset="adcc")
    .segment("standing", 20)                                       # first Segment: no Transition
    .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
    .reset("standing")                                             # referee Reset, no Initiator
    .score(65, A, "points", 2)
    .result(winner=A, method="points"),
)
```

Segments are given by duration and laid end to end, so they always tile the Match. Use `.relabel_of(id)` for a re-label, and `write_raw` for a malformed file.

## Opening the notebook

```
.venv/bin/pip install jupyterlab
.venv/bin/jupyter lab analysis/corpus-analysis.ipynb
```

Or open it in VS Code and pick `.venv` as the kernel. While `annotations/` is empty, the notebook falls back to the fictional sample in `vocab/examples/`. Filters such as `{"ruleset": "adcc", "gi": False}` go in the `FILTERS` cell.

## What's in the package

| Function | Returns |
| --- | --- |
| `load_corpus(dir, ruleset=, gi=, weight_class=, event=, bracket=, include_relabels=False)` | A `Corpus`: `matches` and `segments` tables, the raw `annotations`, and `rejected` (each file that failed the schema or used unknown vocabulary ids, with the reasons). Re-labels are excluded by default. |
| `earned_transitions(corpus)` | One row per earned Transition. Resets are path breaks, so the Segments either side of one are not linked. |
| `next_position_distribution(corpus, prior_strength=2, family_prior_strength=1)` | The first-order next-Position distribution per Position: raw counts plus a probability smoothed with a Dirichlet prior pooled by Family. The formula is in the docstring. |
| `next_position_transitions(corpus)` | The Transition types leading from each Position to each next Position, with counts and shares. |
| `transition_network(corpus)` / `plot_transition_network(graph, node_color=None)` | A networkx graph (nodes are Positions, edges carry earned Transition `count`) and a static plot of it. `node_color` takes a value per Position, for example a Positional Eval. |
