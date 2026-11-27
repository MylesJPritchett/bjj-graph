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
| `positional_eval(corpus, cap=30, prior_strength=2, family_prior_strength=1, base_prior_strength=1, credible_mass=0.9)` | The Positional Eval: one row per Position from its headline perspective (first Role holder, or Initiator for a symmetric Position), with P(win / loss / draw), their credible-interval bounds (`p_*_low` / `p_*_high`), the Family mean it is pooled towards and the sample sizes (`matches`, `segments`, `weight`). The model is in the docstring of `positional_eval_by_perspective`. |
| `positional_eval_by_perspective(corpus, ...)` | The same Eval with two rows per Position: `first_role` / `second_role` (asymmetric) or `initiator` / `opponent` (symmetric). The mirror row swaps win and loss, so later analyses (Retention) can look up any Athlete's Eval in any Position by `position_id` and `perspective`. |
| `eval_contributions(corpus, cap=30)` | What each Match × Position × Athlete contributes: Segment count, `raw_weight` (summed `min(duration, cap) / cap`), `weight` (capped at 1) and the outcome for that Athlete. |
| `eval_sensitivity(corpus, caps=(15, 30, 60), ...)` | `positional_eval` re-run at each cap, stacked with a `cap` column. |
| `transition_network(corpus)` / `plot_transition_network(graph, node_color=None)` | A networkx graph (nodes are Positions, edges carry earned Transition `count`) and a static plot of it. `node_color` takes a value per Position, for example a Positional Eval. |
