# Label Guide

Version 0.1 (for vocabulary 0.1.0). These are the rules for turning Match footage into an Annotation. The Position and Transition definitions live in [`vocab/vocabulary.json`](../vocab/vocabulary.json). This guide covers how to apply them and what to do in the awkward cases.

When a case comes up that this guide doesn't settle, decide it, label it, and add the decision here so the next Match is labelled the same way.

## Core rules

### Segments tile the Match

- The Match starts at the referee's start signal and ends when the referee stops the bout for the last time (tap, final whistle, or disqualification). Mark both as video offsets.
- Every moment between those offsets belongs to exactly one Segment. There are no gaps and no overlaps.
- Time when the Athletes are separated by the referee (stoppages, out-of-bounds restarts) belongs to the Segment that follows the Reset, usually Standing. Don't create a separate "paused" Segment.

### The 3s establishment rule, with backdating

A Position counts only once it has been **held for at least 3s**. When it has been held that long, its Segment **starts when the Position was first reached**, not when the 3s were up.

- Example: a pass lands in side control at 1:12.0 and is still held at 1:15.0. The side control Segment starts at 1:12.0.
- A Position held for less than 3s is not a Segment. Fold that time into the neighbouring Segment it belongs to:
  - a brief flicker through a Position on the way somewhere else (e.g. half a second in half guard during a pass to mount) goes into the Segment it leads to, and the Transition is labelled by the overall movement (here: a pass from guard to mount);
  - a run of several brief Positions with no clear winner becomes one **Scramble** Segment.
- If a Position is reached, lost within 3s, and then the Athletes return to the previous Position, the previous Segment simply continues. Nothing happened.
- Submission Positions follow the same rule. A hold locked on for under 3s and immediately abandoned is not a Submission Position.

Exception: the final Segment of a Match ending in a submission is labelled even if it's shorter than 3s, when the Match ends in that hold (e.g. a fast heel hook finish). The annotation tool will flag it; leave a note that it was deliberate.

### When to use Scramble

Use **Scramble** when, for 3s or more, no named Position holds:

- both Athletes are moving and neither has control (wrestling on the mat after a failed takedown, a sweep that hasn't resolved, both fighting to come up on top);
- the Position flickers through several named Positions, each under 3s;
- the camera angle or an occlusion means you can't tell which Position holds. If you can tell from what happens next, label the Position instead.

Do **not** use Scramble:

- for a short transition between two clear Positions (fold it into the next Segment, as above);
- when the Athletes are in a recognisable Position you can't name precisely. Pick the closest Position in the right Family, e.g. an unusual open guard is still Open guard;
- for referee stoppages. Those are Resets.

Transitions into and out of Scramble are usually typed **Other**, unless a clearer type fits: an escape from mount that turns into a scramble is an Escape, and a scramble that ends with one Athlete passing to side control is a Pass.

### Roles and the first Role holder

- Asymmetric Positions have two Roles, listed in the vocabulary with the first Role first (e.g. `guard / passer`, `attacker / defender`). Record which Athlete holds the **first** Role. The other Athlete holds the second.
- Symmetric Positions (Standing, Double guard, 50/50, Scramble) have no Roles. Never record a Role holder for them.
- When the Role holder changes but the Position doesn't (e.g. a sweep from open guard into the other Athlete's open guard), that's a new Segment with a Transition, not a continuation.

### Transitions and the Initiator

- Each Segment after the first records the Transition that entered it: its type and its Initiator, the Athlete who caused it.
- The Initiator is the Athlete whose action produced the new Position, not the one who ends up better off. A guard pull's Initiator is the puller. An escape's Initiator is the escaping Athlete.
- When both Athletes contribute, credit the one whose action decided where they ended up. If you can't tell, use Scramble and Other rather than guess.
- **Reset** never has an Initiator, even when one Athlete caused the stoppage (e.g. by stalling or fleeing the mat). Any penalty for it is a Score Event.
- A Segment directly after a Reset still starts a new path. Two Standing Segments either side of a Reset are expected and fine.

### Relative directions, never left and right

Describe sides relative to the Athletes, so that mirror images are the same Position:

- **Near / far side**: relative to the Athlete doing the controlling. The near side is the side of the opponent's body closest to them, the far side is the side away from them. In side control the near arm is the bottom Athlete's arm closest to the pinner's hips.
- **Same / cross side**: relative to a limb. A same-side grip or hook is on the same side of the body as the limb it controls (right hand to opponent's left wrist when facing each other is same side). A cross-side one reaches across the centre line (right hand to opponent's right wrist).
- For leg entanglements, "same-side hip" means the hip on the same side as the trapped leg, and "cross-side hip" the other one.
- Never record or decide a Position by left or right. A left-side and a right-side ashi garami are both Single-leg X / ashi garami.

### Scoring stays on its own track

Positions and Transitions carry no scoring meaning (ADR-0001). Record points, advantages, penalties, scored submission attempts and the submission finish as **Score Events** on the Event track, at the moment the referee awards them, labelled by the Match's ruleset. Don't change a Segment's timing to line up with a referee's (possibly late) score.

- A pass that the ruleset doesn't score (e.g. in the first half of an ADCC Match) is still a Pass.
- A submission finish is recorded twice on purpose: the Match ends in a Submission Position, and a `submission_finish` Score Event is credited to the attacker at the tap.

### Result and Method

- Record the official Result even when the footage disagrees. If they disagree, say so in a note.
- `draw` is the only Method without a winner.
- A submission finish needs a final `submission_finish` Score Event during the last Segment, and the last Segment should be a Submission Position with the winner as attacker.

## Position edge cases

### Standing

- **Standing vs. Standing leg attack**: a single or double leg counts once the attacker holds the leg with both hands (or wraps it) for 3s. Shooting and getting sprawled on within 3s stays Standing (or becomes Turtle or Scramble, depending on where they land).
- A clinch (collar tie, two-on-one, underhooks, body lock from the front) is still Standing. A body lock from behind is Standing back.
- An attacker dropping to a knee for a single leg is still a Standing leg attack while the defender is upright.

### Guard

- **Closed vs. open guard**: closed guard needs the ankles crossed behind the passer. Opening the ankles to attack is a Transition to Open guard (type Other, Initiator the guard player) only if the open guard holds for 3s.
- **Open guard vs. Standing**: the guard player must be seated or supine with at least one leg engaged with the passer. A seated Athlete with the opponent out of range is still Open guard if they're sitting there on purpose. If both stand back up, it's Standing.
- **Double guard**: both Athletes seated with neither on top. Once one comes up on top into a guard, it's Open guard with that Athlete as passer.
- Guard players attacking a leg with their own legs: once a leg entanglement from the vocabulary forms, it's a Leg entanglement Position, not Open guard. X-guard and single-leg X used to sweep rather than to attack the leg are judged by what the entanglement looks like: if it matches Single-leg X / ashi garami, use it.

### Half guard

- Half guard requires one of the passer's legs trapped between the guard player's legs. A knee shield with no leg trapped is Open guard.
- **Deep half** needs the guard player's head and shoulders under the passer's hips. Otherwise use Half guard.
- A passer who has freed their knee but not the foot is still in Half guard.

### Side control

- **Side control vs. half guard**: once the passer's legs are free and the chest is across, it's Side control, even with the bottom Athlete's knee in the way.
- North-south and knee on belly are their own Positions. Moving between them and Side control is an Advance.
- Reverse kesa / scarf hold variants are Side control.

### Mount

- S-mount and technical mount are Mount.
- High mount on the armpits is Mount. Once the mounter falls back for an armbar and locks it on, it's Armbar.
- A mount with one leg trapped by the bottom Athlete is Half guard (the trap means it isn't past the legs).

### Back

- Back control on the ground needs chest to back plus two hooks, a body triangle, or a seatbelt with one hook. A seatbelt alone with the defender turtled is Turtle.
- Standing back needs the defender upright (or on one knee) and the back taker attached from behind.
- When the back taker has the choking arm across the neck with the grip locked, it's Rear naked choke. Hand fighting under the chin, grip not locked, is still Back control.

### Turtle

- Turtle needs the turtled Athlete belly down on knees and elbows (or knees and hands). Front headlock on a turtled Athlete is Turtle until a guillotine or d'arce is locked.
- A failed takedown where the defender sprawls on a turtled shooter: Turtle with the sprawling Athlete as rider, entered by Other (Initiator the sprawler). It isn't a Takedown: the sprawler didn't bring anyone down.

### Leg entanglement

- Label the entanglement by the legs, not by the grips. The submission (Heel hook or Other submission) starts only when the attacker has the heel or foot isolated and is turning or extending it.
- **Single-leg X / ashi garami**: the attacker's legs stay on the same side of the trapped leg. X-guard, the standard ashi garami and the straight-ankle-lock entry are all here.
- **Outside ashi**: the attacker's top leg crosses over the trapped thigh to the outside.
- **Inside sankaku / saddle**: the attacker's top leg goes between the defender's legs towards the cross-side hip, legs triangled or nearly so (411, honey hole).
- **50/50**: both trap each other's same-side leg in mirror image. Being symmetric, it has no Roles; the Initiator of the Transition into it is recorded instead.
- **Backside 50/50**: a 50/50 in which one Athlete has turned away. The Athlete still facing is the attacker. If the defender turns back to face, that's a Transition back to 50/50 (Other, Initiator the defender).
- Both Athletes attacking legs at once in a non-mirrored way: label the entanglement that the more dangerous attacker holds, and use that Athlete as attacker. If you can't tell, Scramble.

### Submission

- A Submission Position starts when the hold is locked on and being worked, not when the attacker starts reaching for it. Reaching that never locks on is an Attempt, which isn't recorded (it may be a scored attempt in some rulesets: that goes on the Score Event track).
- The attacker keeps the hold but loses the lock: if the lock comes back within 3s, it's still the Submission Position. Otherwise, the Transition out is a Submission escape (Initiator the defender) to the Position they're now in.
- An attacker voluntarily releasing a hold to change to another Position is not a Submission escape. Use Advance or Other, Initiator the attacker.
- Chaining submissions (triangle to armbar) is a Transition between two Submission Positions, typed Submission entry with the attacker as Initiator.
- A tap ends the Match in the Submission Position.

## Transition edge cases

- **Takedown vs. guard pull**: whoever chose to go to the ground. If the bottom Athlete sat down on purpose, it's a Guard pull, Initiator the puller. A guard pull that the opponent follows straight into a pass is two Transitions only if the guard holds for 3s; otherwise label the whole thing as a Pass into the Position where it ends.
- **Sweep vs. escape**: a sweep starts from guard or half guard and ends with the guard player on top or standing over the opponent. Getting out from under a pin, mount or back is an Escape, even if the escaping Athlete ends on top.
- **Pass vs. advance**: a Pass clears the legs from guard or half guard into side control, mount, knee on belly or north-south. Partial progress (open guard to half guard) and movement between pins are Advances.
- **Back take**: entering back control or standing back from any Position, including from Turtle. Moving between Back control and Standing back with the same back taker is Other (Initiator whoever caused it), not a new Back take.
- **Leg entry vs. guard pull**: sitting straight into an entanglement from standing is a Guard pull. Entering one from a guard, from standing while the opponent is already seated, or from another entanglement is a Leg entry.
- **Disengage**: an Athlete who isn't losing walks away (e.g. a passer standing up out of the guard and stepping back). If the referee steps in, it's a Reset instead.
- **Reset**: always the referee's call. Out-of-bounds restarts, stand-ups for stalling, and restarts after injury or equipment stoppages.
- **Other**: the catch-all. Use it sparingly and leave a note if it's not a Scramble entry or exit, so recurring cases can be promoted to their own type.

## Changing this guide or the vocabulary

- Bump the vocabulary `version` in `vocab/vocabulary.json` whenever a Position or Transition is added, removed or redefined: minor for additions, major for removals or changed meanings.
- Record the reason here.
- Annotations keep the vocabulary version they were labelled with, so older ones can be found and migrated.
