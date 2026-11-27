// The command registry. To add a command:
//   1. define its type and handler in a file in this folder (one file per area);
//   2. add the type to `Command` and the handler to `handlers` below.
// A handler is a pure function (session, command) => session. It calls
// `reject(reason)` to refuse a command, which leaves the session unchanged.

import type { Session } from "../state";
import { setAthletes, type AthleteCommand } from "./athletes";
import { addScoreEvent, editScoreEvent, removeScoreEvent, type EventCommand } from "./events";
import { setMatchEnd, setMatchStart, type MatchCommand } from "./match";
import { setLicence, setMetadata, type MetadataCommand } from "./metadata";
import { clearResult, setResult, type ResultCommand } from "./result";
import { startSegment, type SegmentCommand } from "./segments";

export type Command = MatchCommand | AthleteCommand | SegmentCommand | EventCommand | ResultCommand | MetadataCommand;

type Handlers = { [T in Command["type"]]: (session: Session, command: Extract<Command, { type: T }>) => Session };

export const handlers: Handlers = {
  set_match_start: setMatchStart,
  set_match_end: setMatchEnd,
  set_athletes: setAthletes,
  start_segment: startSegment,
  add_score_event: addScoreEvent,
  edit_score_event: editScoreEvent,
  remove_score_event: removeScoreEvent,
  set_result: setResult,
  clear_result: clearResult,
  set_metadata: setMetadata,
  set_licence: setLicence,
};

export type { AthleteCommand, EventCommand, MatchCommand, MetadataCommand, ResultCommand, SegmentCommand };
