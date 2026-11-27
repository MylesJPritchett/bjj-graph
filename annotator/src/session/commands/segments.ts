import { positionById, reject, withAnnotation, type Session } from "../state";
import type { Segment, VideoTime, VocabId } from "../types";

export interface StartSegment {
  type: "start_segment";
  /** The playhead: the current Segment closes here and the new one opens. */
  time: VideoTime;
  position_id: VocabId;
}

export type SegmentCommand = StartSegment;

export function startSegment(session: Session, command: StartSegment): Session {
  const match = session.annotation.match;
  if (!match) reject("Set the Match start and end offsets before labelling Positions.");
  if (!positionById(session, command.position_id)) reject(`Unknown Position "${command.position_id}".`);

  const segments = session.annotation.segments;
  const opened: Segment = { start: match.start_offset, end: match.end_offset, position_id: command.position_id };

  // The first Segment always tiles the whole Match.
  if (segments.length === 0) return withAnnotation(session, { segments: [opened] });

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
