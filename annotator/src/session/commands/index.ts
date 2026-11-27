// The command registry. To add a command:
//   1. define its type and handler in a file in this folder (one file per area);
//   2. add the type to `Command` and the handler to `handlers` below.
// A handler is a pure function (session, command) => session. It calls
// `reject(reason)` to refuse a command, which leaves the session unchanged.
// Every command except undo and redo is undoable automatically.

import type { Session } from "../state";
import { setAthletes, type AthleteCommand } from "./athletes";
import { deleteSegment, editSegment, moveBoundary, type EditingCommand } from "./editing";
import { addScoreEvent, editScoreEvent, deleteScoreEvent, type EventCommand } from "./events";
import { redo, undo, type HistoryCommand } from "./history";
import { setMatchEnd, setMatchStart, type MatchCommand } from "./match";
import { setLicence, setMetadata, type MetadataCommand } from "./metadata";
import { clearResult, setResult, type ResultCommand } from "./result";
import { startSegment, type SegmentCommand } from "./segments";

export type Command =
  | MatchCommand
  | AthleteCommand
  | SegmentCommand
  | EditingCommand
  | HistoryCommand
  | EventCommand
  | ResultCommand
  | MetadataCommand;

type Handlers = { [T in Command["type"]]: (session: Session, command: Extract<Command, { type: T }>) => Session };

export const handlers: Handlers = {
  set_match_start: setMatchStart,
  set_match_end: setMatchEnd,
  set_athletes: setAthletes,
  start_segment: startSegment,
  move_boundary: moveBoundary,
  delete_segment: deleteSegment,
  edit_segment: editSegment,
  undo,
  redo,
  add_score_event: addScoreEvent,
  edit_score_event: editScoreEvent,
  delete_score_event: deleteScoreEvent,
  set_result: setResult,
  clear_result: clearResult,
  set_metadata: setMetadata,
  set_licence: setLicence,
};

/** Commands that move through the history rather than being recorded in it. */
export const isHistoryCommand = (command: Command): command is HistoryCommand =>
  command.type === "undo" || command.type === "redo";

export type {
  AthleteCommand,
  EditingCommand,
  EventCommand,
  HistoryCommand,
  MatchCommand,
  MetadataCommand,
  ResultCommand,
  SegmentCommand,
};
export { recordChange } from "./history";
