# BJJ Graph

A statistics database of how grappling matches flow through positions and transitions, built from hand-annotated match footage.

## Language

### Matches and data

**Match**:
One bout between two athletes, from the referee's start to the end of the bout, including any restarts within it.
_Avoid_: Fight, roll, round, sequence

**Corpus**:
A collection of annotated Matches sharing a source and purpose (e.g. elite competition footage vs. own-gym sparring), analysed separately.
_Avoid_: Dataset, collection

**Bracket**:
Every Match in one division of one event. The unit of Match selection: we annotate whole Brackets, not hand-picked Matches.
_Avoid_: Division (when meaning the set of Matches), draw

**Label Guide**:
The written rules for turning footage into an Annotation: the definitions of Positions and Transitions, plus their edge cases.
_Avoid_: Spec, rulebook

**Annotation**:
The labelled record of one Match: its metadata plus its time-ordered positions and transitions.
_Avoid_: Label file, tagging

### Graph

**Position**:
A named configuration of the two athletes (e.g. closed guard, mount), grouped under a Family.
_Avoid_: State, node (in domain talk)

**Family**:
A coarse group of related Positions (e.g. guard, half guard, back).
_Avoid_: Category, class

**Transition**:
A movement from one Position to another, typed by how it happened (e.g. sweep, pass, takedown).
_Avoid_: Move, technique, edge (in domain talk)

**Reset**:
A Transition imposed by the referee (stand-up, out-of-bounds restart) rather than earned by an athlete.
_Avoid_: Restart, stand-up

**Role**:
One of the two named sides of an asymmetric Position (e.g. guard / passer in closed guard). Symmetric Positions have no Roles.
_Avoid_: Top/bottom (as a general term), side

**Segment**:
A span of Match time spent in a single Position, which must be held at least 3s to count (shorter spells fold into Scramble). Segments tile the whole Match with no gaps; a Transition is the boundary between two adjacent Segments.
_Avoid_: Interval, phase, period

**Scramble**:
The Position used for unclear, in-between moments where no named Position holds.
_Avoid_: Unknown, transition zone

### People

**Athlete**:
A real competitor, identified consistently across Matches. Athletes hold Roles within Segments.
_Avoid_: Player, fighter, competitor

**Initiator**:
The Athlete who caused a Transition. For a symmetric Position, this is the perspective its Positional Eval is reported from.
_Avoid_: Actor, attacker, aggressor

### Scoring and outcomes

**Score Event**:
A timestamped, ruleset-specific scoring occurrence (points, advantage, penalty, submission finish) credited to an Athlete. Recorded on a track separate from Segments.
_Avoid_: Point, score (as a noun for the record)

**Attempt**:
An Athlete's unsuccessful try at a sweep, pass or other Transition that never establishes a Position. Not recorded yet; left out deliberately because it's hard to label consistently. (Submission attempts are not Attempts: they're recorded as submission Positions.)
_Avoid_: Try, threat

**Submission Position**:
A Position in the submission Family (e.g. armbar, triangle) with attacker / defender Roles. Escaping it is a Transition out; finishing it ends the Match and is a Score Event. Some rulesets also score the attempt itself.
_Avoid_: Submission attempt (as a separate record), sub threat

**Retention**:
How well a Role holder keeps a Position: how long they hold it, and whether they leave it for a better, worse or neutral Position. Reported alongside the Positional Eval, not folded into it.
_Avoid_: Control, hold rate, stickiness

**Positional Eval**:
The estimated probability of each final Match result (win / loss / draw) for a Role holder or Initiator, given only the current Position, ignoring score, clock and Athlete strength. By analogy with a chess engine's evaluation bar.
_Avoid_: Eval (unqualified), score, rating, value

**Situational Eval**:
The estimated probability of each final Match result given the full Match state: Position, score differential, time remaining, Athlete strength and so on. Not built yet.
_Avoid_: Live eval, win probability (unqualified)

**Result**:
A Match's final outcome (winner or draw) together with its Method.
_Avoid_: Outcome, verdict

**Method**:
How a Match was decided: submission, points, advantages, referee decision, disqualification, or draw.
_Avoid_: Win type, finish type

**Event**:
A timestamped point occurrence within a Match, of a typed kind. Score Events are the only kind for now; Attempts would be a future kind.
_Avoid_: Action, marker
