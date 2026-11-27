import { reject, type Session } from "../state";
import type { Annotation, VideoTime } from "../types";

export interface SetMatchStart {
  type: "set_match_start";
  time: VideoTime;
}

export interface SetMatchEnd {
  type: "set_match_end";
  time: VideoTime;
}

export type MatchCommand = SetMatchStart | SetMatchEnd;

export function setMatchStart(session: Session, command: SetMatchStart): Session {
  return setBounds(session, { ...session.bounds, start: command.time });
}

export function setMatchEnd(session: Session, command: SetMatchEnd): Session {
  return setBounds(session, { ...session.bounds, end: command.time });
}

/** Moves the Match offsets, stretching the first and last Segments so they still tile the Match. */
function setBounds(session: Session, bounds: { start?: VideoTime; end?: VideoTime }): Session {
  const { start, end } = bounds;
  if ((start !== undefined && start < 0) || (end !== undefined && end < 0)) reject("Offsets can't be negative.");
  if (start !== undefined && end !== undefined && start >= end) {
    reject(`The Match start (${start}s) must be before its end (${end}s).`);
  }

  const segments = [...session.annotation.segments];
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first && start !== undefined) {
    if (start >= first.end) reject(`The Match start can't move past the end of the first Segment (${first.end}s).`);
    segments[0] = { ...first, start };
  }
  if (last && end !== undefined) {
    const lastNow = segments[segments.length - 1]!;
    if (end <= lastNow.start) reject(`The Match end can't move before the start of the last Segment (${lastNow.start}s).`);
    segments[segments.length - 1] = { ...lastNow, end };
  }

  const { match: _previous, ...rest } = session.annotation;
  const annotation: Annotation =
    start !== undefined && end !== undefined
      ? { ...rest, match: { start_offset: start, end_offset: end }, segments }
      : { ...rest, segments };
  return { ...session, annotation, bounds };
}
