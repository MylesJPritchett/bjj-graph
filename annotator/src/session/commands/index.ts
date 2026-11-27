// The command registry. To add a command:
//   1. define its type and handler in a file in this folder (one file per area);
//   2. add the type to `Command` and the handler to `handlers` below.
// A handler is a pure function (session, command) => session. It calls
// `reject(reason)` to refuse a command, which leaves the session unchanged.

import type { Session } from "../state";
import { setAthletes, type AthleteCommand } from "./athletes";
import { setMatchEnd, setMatchStart, type MatchCommand } from "./match";
import { startSegment, type SegmentCommand } from "./segments";

export type Command = MatchCommand | AthleteCommand | SegmentCommand;

type Handlers = { [T in Command["type"]]: (session: Session, command: Extract<Command, { type: T }>) => Session };

export const handlers: Handlers = {
  set_match_start: setMatchStart,
  set_match_end: setMatchEnd,
  set_athletes: setAthletes,
  start_segment: startSegment,
};

export type { AthleteCommand, MatchCommand, SegmentCommand };
