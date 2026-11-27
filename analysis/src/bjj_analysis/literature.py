"""Family-level sanity checks against published figures.

Lamas L, Heiner M, Ferreira M, Moura A, Rangel W, Fellingham G, Lage V.
"No-gi Brazilian jiu-jitsu: A Markovian analysis of elite-level combat
dynamics." International Journal of Sports Science & Coaching 19(4):
1767-1775, 2024. doi:10.1177/17479541231210979. All 93 Matches of the World
Submission Fighting Championship 2019.

Only the figures stated in the paper's abstract are used: the full text
(with its per-action tables) is behind a paywall and has not been checked.
Lamas et al. code actions (takedown, sweep, guard pass, back-take,
submission attempt), not Positions, so each comparison below is an
approximate Family-level analogue, not the same measure.
"""

from __future__ import annotations

import pandas as pd

from .corpus import Corpus
from .transitions import earned_transitions

COMPARISON_COLUMNS = ["measure", "description", "lamas_2024", "corpus_value", "corpus_basis", "caveat"]


def lamas_2024_comparison(corpus: Corpus) -> pd.DataFrame:
    """The Corpus next to the figures in the abstract of Lamas et al. 2024, one row per measure.

    - `back_to_submission`: Lamas et al. report 0.45 as the probability of a
      back-take leading directly to a submission (the highest of any
      action). Here: the share of earned Transitions out of a back-Family
      Position that enter a submission-Family Position.
    - `submissions_per_athlete_per_match`: Lamas et al. report a point
      estimate of 1.03 submission attempts per match, the only main action
      above one per Athlete per match. Here: submission-Family Segments
      divided by 2 Athletes × Matches. A chain (triangle into armbar) counts
      each Segment.

    `corpus_value` is empty when the Corpus has no data for a measure.
    """
    transitions = earned_transitions(corpus)
    from_back = transitions[transitions["from_family"] == "back"]
    to_submission = int((from_back["to_family"] == "submission").sum())
    submissions = int((corpus.segments["family"] == "submission").sum())
    matches = len(corpus.matches)

    rows = [
        {
            "measure": "back_to_submission",
            "description": "P(next earned Transition from the back enters a submission)",
            "lamas_2024": 0.45,
            "corpus_value": to_submission / len(from_back) if len(from_back) else float("nan"),
            "corpus_basis": f"{to_submission} of {len(from_back)} earned Transitions out of the back Family",
            "caveat": "Lamas et al.: back-take action to submission action; here: back Family to submission Family",
        },
        {
            "measure": "submissions_per_athlete_per_match",
            "description": "Submission attempts per Athlete per Match",
            "lamas_2024": 1.03,
            "corpus_value": submissions / (2 * matches) if matches else float("nan"),
            "corpus_basis": f"{submissions} submission Segments in {matches} Matches",
            "caveat": "Lamas et al. count attempts; here a submission Position held at least 3s",
        },
    ]
    return pd.DataFrame(rows, columns=COMPARISON_COLUMNS)
