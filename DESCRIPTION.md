# BJJ / Grappling Analysis Project

## Goal
Build a statistics database of how BJJ/grappling matches flow through positions and transitions, so athletes and coaches can see the most-used, highest-value paths backed by data (rather than "I saw a champion do this move").

Mental model: each match is a path through one large shared graph (the sport). Nodes = positions, edges = transitions. Each match touches a small part of it; aggregated across many matches we get empirical transition frequencies and outcomes.

## Key decisions so far
- **Primary direction: event-sequence statistics, not computer vision.** Annotating a per-match sequence of (time, position, transition, actor, outcome) is far cheaper than frame-level pose labels. CV is an optional later accelerator (e.g. proposing segments for human correction).
- **Position schema = base position + roles + sparse facts** (not a deep tree; facts like underhook/overhook/hook are independent, so a tree explodes combinatorially).
  - `family` (~10: standing, guard, half guard, side control, mount, back, turtle, leg entanglement, scramble, submission)
  - `position` (~20-60 named positions)
  - `roles` (top/bottom or attacker/defender, mapped to athletes separately)
  - `facts`: sparse set of typed relations, e.g. `(A.left_arm, underhook, B.right_side)`; absent = unspecified, not false
  - Use relative terms (near/far side, same/cross side, inside/outside) instead of left/right to collapse mirror images
  - Discretize continuous measures into 2-3 bins with hysteresis (tight/neutral/wide)
  - A more specific position = same position with a superset of facts (subsumption lattice, not a tree)
- **For the statistics MVP use only family + position + transition type.** Add the fact layer later, only where it answers a concrete question.
- **Temporal model:** positions are segments (start, end); grips/facts are events on top; transitions are edges between segments.

## Analysis design concerns
- **Sparsity:** use hierarchical pooling (rare positions borrow strength from their family); report credible intervals, not raw percentages.
- **Confounding by skill:** better athletes reach better positions. Include athlete/opponent strength as covariates, or results just reflect "what winners do".
- **Stratify/record metadata:** ruleset (IBJJF/ADCC/etc.), belt/level, weight class, gi vs no-gi.
- **Markov order:** test first-order vs second-order (how you got to a position matters).
- **Define "where it leads" explicitly:** points, submission, reversal, stalemate, position retained after N seconds.
- **Selection bias:** only filmed/published matches are available; skews to finals and famous athletes.
- **Splits:** if ML is added, split by match/athlete/session, never by frame.

## MVP plan
1. Pick one ruleset + level with openly available footage.
2. Define ~20-30 positions and ~10-15 transition types; write a one-page label guide with edge cases.
3. Build a minimal local annotation tool (video playback, keyboard shortcuts, segment labeling, JSON export per match, git-versionable). No accounts/uploads/collab yet.
4. Annotate ~50-100 matches. Check self-consistency by re-labeling a few clips a week later.
5. Compute transition matrix with simple pooling; visualize (Sankey or network graph; edge width = frequency, colour = win rate).
6. Identify where data is too sparse; compare to published Markov results as a sanity check.
7. Expand matches, then divisions, before adding detail. Version schema, labels, and metadata.

## Per-match metadata to record
source, event, ruleset, gi/no-gi, weight class, belt/level, camera type/angle, resolution, athlete ids, license/permission status.

## If CV is added later
- Pipeline reference: merge top-down (YOLOX+RTMPose) and bottom-up (RTMO) pose models, then track identities (Hungarian assignment + gap filling).
- Multi-head prediction (family head, position head, one binary head per fact type) with masked loss for partial labels.
- Broadcast footage needs shot-boundary detection, replay/crowd filtering, and per-segment pose extraction. Domain shift vs gym footage is real; keep a separate test set from own gym footage.

## Legal / ethics notes (not legal advice; verify)
Tournament footage is generally copyrighted and platform ToS restrict downloading. Sharing only derived labels (timestamps, positions) is lower risk than sharing video but not a guarantee. Prefer openly licensed footage or get permission. Get consent before labeling/sharing other people's footage.

## Prior art (found Nov 2026)
- Lamas et al. 2024, "No-gi BJJ: A Markovian analysis of elite-level combat dynamics" (Int. J. Sports Sci. & Coaching): 93 matches, WSFC 2019, Bayesian Markov, reward-risk balance.
- arXiv preprint "Hierarchical Absorbing Markov Chain Models for Pooling Sparse Combat Sequence Data" (extends Lamas by weight category).
- BJJ Heroes data articles (manual tallies; e.g. guard-pass study on 1000+ IBJJF black belt matches; ADCC post-event analyses): https://www.bjjheroes.com/editorial/bjj-data-analysis-essay-almanac
- Digitsu competition archive (results only, ~40k matches, not position paths): https://digitsu.com/events
- GrappleMap (public-domain theoretical position/transition graph) and https://ggivingg.github.io/bjj-markov/ (pairs it with ViCoS frequencies)
- ViCoS BJJ Positions Dataset (CC BY-NC-SA 4.0; 120K labeled frames, 6 sparring sequences, 18 classes)
- Hugging Face `carlosj934/BJJ_Positions_Submissions` (tiny, keypoints + labels)
- Roboflow Universe grappling sets
- CV repos: ValterH/automatic-positions-detection-and-scoring-in-jiu-jitsu (paper code), ErayAmath/Bjj-Position, Atzingen/bjj-detector, talhaahussain/grappling-pose-identification, tadrianonet/jiu-analyse
- Commercial LLM "AI coach" apps (Ground CTRL, Grappling AI, Roll by KAYYO, SmartBJJ, LiveRoll, mmaGPT): video review, not statistics.
- Gap: no large open path-level position statistics from many matches.

## Open questions for the user
- Target use: personal rolls, competition analysis, or coach/gym tool?
- Stack and experience level?
- Which ruleset/level to start with?
- Who annotates (solo, community)?

## Suggested first tasks for Claude Code
1. Draft `schema/positions.json` and `schema/transitions.json` (coarse vocabulary) plus the match annotation file format.
2. Build the minimal local annotation web app.
3. Write the analysis notebook: pooled transition matrix, graph visualization, uncertainty intervals.
