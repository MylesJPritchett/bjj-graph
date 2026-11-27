// Fixing mistakes on the timeline: retiming a Transition, editing a Segment's
// labels, and deleting a Segment.

import { positionById, reject, withAnnotation, type Session } from "../state";
import type { AthleteSlug, Segment, VideoTime } from "../types";

export interface MoveBoundary {
  type: "move_boundary";
  /** The Segment whose start moves; the end of the Segment before it moves with it. */
  segment: number;
  time: VideoTime;
}

export interface DeleteSegment {
  type: "delete_segment";
  segment: number;
  /**
   * Which neighbour takes over the deleted Segment's time (default "previous").
   * Falls back to the other neighbour at either end of the Match.
   */
  absorbed_by?: "previous" | "next";
}

/** A Segment's labels: everything but its timing, which only boundary moves change. */
type SegmentLabels = Omit<Segment, "start" | "end">;
type OptionalLabel = { [K in keyof SegmentLabels]-?: undefined extends SegmentLabels[K] ? K : never }[keyof SegmentLabels];

export interface EditSegment {
  type: "edit_segment";
  segment: number;
  /** Fields to change. `null` clears an optional field; fields left out are kept. */
  set: { [K in keyof SegmentLabels]?: K extends OptionalLabel ? SegmentLabels[K] | null : SegmentLabels[K] };
}

export type EditingCommand = MoveBoundary | DeleteSegment | EditSegment;

export function editSegment(session: Session, command: EditSegment): Session {
  const { segment: index, set } = command;
  const segments = session.annotation.segments;
  const current = segments[index];
  if (!current) reject(`There is no Segment ${index + 1}.`);

  const edited: Record<string, unknown> = { ...current };
  for (const [field, value] of Object.entries(set)) {
    if (value === undefined) continue;
    if (value === null) delete edited[field];
    else edited[field] = value;
  }
  const segment = edited as unknown as Segment;

  if (!positionById(session, segment.position_id)) reject(`Unknown Position "${segment.position_id}".`);
  const athletes = session.annotation.athletes;
  const checkAthlete = (slug: AthleteSlug | undefined, what: string) => {
    if (slug !== undefined && !athletes.includes(slug)) reject(`The ${what} must be one of the Match's Athletes, not "${slug}".`);
  };
  checkAthlete(segment.first_role_holder, "Role holder");
  if (segment.entered_by) {
    if (index === 0) reject("The first Segment has no incoming Transition.");
    const { transition_type, initiator } = segment.entered_by;
    if (!session.context.vocabulary.transitions.some((t) => t.id === transition_type)) {
      reject(`Unknown Transition type "${transition_type}".`);
    }
    checkAthlete(initiator, "Initiator");
  }

  const next = [...segments];
  next[index] = segment;
  return withAnnotation(session, { segments: next });
}

export function deleteSegment(session: Session, command: DeleteSegment): Session {
  const { segment: index } = command;
  const segments = session.annotation.segments;
  const deleted = segments[index];
  if (!deleted) reject(`There is no Segment ${index + 1}.`);

  const next = [...segments];
  next.splice(index, 1);
  const previous = next[index - 1];
  const following = next[index];
  const nextAbsorbs = following && (command.absorbed_by === "next" || !previous);
  if (nextAbsorbs) next[index] = { ...following, start: deleted.start };
  else if (previous) next[index - 1] = { ...previous, end: deleted.end };
  // The first Segment has no incoming Transition.
  if (index === 0 && next[0]) {
    const { entered_by: _dropped, ...first } = next[0];
    next[0] = first;
  }
  return withAnnotation(session, { segments: next });
}

export function moveBoundary(session: Session, command: MoveBoundary): Session {
  const { segment: index, time } = command;
  const segments = session.annotation.segments;
  const before = segments[index - 1];
  const after = segments[index];
  if (!before || !after) {
    reject("Only a boundary between two Segments can be moved; use the Match start and end for the outer edges.");
  }
  if (time <= before.start || time >= after.end) {
    reject(`The boundary must stay between ${before.start}s and ${after.end}s.`);
  }
  const next = [...segments];
  next[index - 1] = { ...before, end: time };
  next[index] = { ...after, start: time };
  return withAnnotation(session, { segments: next });
}
