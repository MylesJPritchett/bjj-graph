import { positionById, reject, withAnnotation, type Session } from "../state";
import type { AthleteSlug, Segment, Transition, VideoTime, VocabId } from "../types";

export interface StartSegment {
  type: "start_segment";
  /** The playhead: the current Segment closes here and the new one opens. */
  time: VideoTime;
  position_id: VocabId;
  /** The Transition that entered the new Segment. The first Segment has none. */
  entered_by?: Transition;
  /** Asymmetric Positions: the Athlete in the Position's first Role. */
  first_role_holder?: AthleteSlug;
}

export type SegmentCommand = StartSegment;

export function startSegment(session: Session, command: StartSegment): Session {
  const match = session.annotation.match;
  if (!match) reject("Set the Match start and end offsets before labelling Positions.");
  if (!positionById(session, command.position_id)) reject(`Unknown Position "${command.position_id}".`);
  checkTransition(session, command.entered_by);
  if (command.first_role_holder !== undefined) checkMatchAthlete(session, command.first_role_holder, "Role holder");

  const segments = session.annotation.segments;
  const opened: Segment = {
    start: match.start_offset,
    end: match.end_offset,
    position_id: command.position_id,
    ...(command.first_role_holder !== undefined && { first_role_holder: command.first_role_holder }),
    ...(command.entered_by && { entered_by: { ...command.entered_by } }),
  };

  // The first Segment always tiles the whole Match.
  if (segments.length === 0) {
    if (command.entered_by) reject("The first Segment starts the Match, so no Transition enters it.");
    return withAnnotation(session, { segments: [opened] });
  }

  const { time } = command;
  if (time < match.start_offset || time >= match.end_offset) {
    reject(`The playhead (${time}s) is outside the Match (${match.start_offset}s to ${match.end_offset}s).`);
  }
  const index = segments.findIndex((s) => s.start <= time && time < s.end);
  const current = segments[index];
  if (!current) reject(`No Segment covers ${time}s.`);
  if (current.start === time) reject(`A Segment already starts at ${time}s.`);

  const next = [...segments];
  next.splice(index, 1, { ...current, end: time }, { ...opened, start: time, end: current.end });
  return withAnnotation(session, { segments: next });
}

function checkTransition(session: Session, transition: Transition | undefined) {
  if (!transition) return;
  const known = session.context.vocabulary.transitions.some((t) => t.id === transition.transition_type);
  if (!known) reject(`Unknown Transition type "${transition.transition_type}".`);
  if (transition.initiator !== undefined) checkMatchAthlete(session, transition.initiator, "Initiator");
}

function checkMatchAthlete(session: Session, slug: AthleteSlug, what: string) {
  if (!session.annotation.athletes.includes(slug)) reject(`${what} "${slug}" isn't one of the Match's Athletes.`);
}
