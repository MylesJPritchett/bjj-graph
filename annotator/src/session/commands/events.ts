// Score Events: the scoring track, kept apart from Segments (ADR-0001).

import { reject, withAnnotation, type Session } from "../state";
import type { AthleteSlug, MatchEvent, ScoreEvent, VideoTime } from "../types";

/** A Score Event's fields, without its `kind`. */
export interface ScoreEventFields {
  time: VideoTime;
  athlete: AthleteSlug;
  score_type: ScoreEvent["score_type"];
  value?: number;
  note?: string;
}

export interface AddScoreEvent extends ScoreEventFields {
  type: "add_score_event";
}

export interface EditScoreEvent {
  type: "edit_score_event";
  /** Index into `annotation.events`. */
  index: number;
  /** The Score Event's new fields; replaces the old ones entirely. */
  event: ScoreEventFields;
}

export interface RemoveScoreEvent {
  type: "remove_score_event";
  index: number;
}

export type EventCommand = AddScoreEvent | EditScoreEvent | RemoveScoreEvent;

function scoreEvent(session: Session, fields: ScoreEventFields): ScoreEvent {
  const { time, athlete, score_type, value, note } = fields;
  if (!(time >= 0)) reject("A Score Event's time can't be negative.");
  if (!session.annotation.athletes.includes(athlete)) reject(`"${athlete}" isn't one of this Match's Athletes.`);
  if (value !== undefined && !Number.isFinite(value)) reject("A Score Event's value must be a number.");
  const event: ScoreEvent = { kind: "score", time, athlete, score_type };
  if (value !== undefined) event.value = value;
  if (note?.trim()) event.note = note.trim();
  return event;
}

/** Events stay in time order; Events at the same time keep the order they were recorded in. */
function inTimeOrder(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort((a, b) => a.time - b.time);
}

function existing(session: Session, index: number): MatchEvent {
  const event = session.annotation.events[index];
  if (!event) reject(`There's no Event ${index + 1}.`);
  return event;
}

export function addScoreEvent(session: Session, command: AddScoreEvent): Session {
  const { type: _type, ...fields } = command;
  const event = scoreEvent(session, fields);
  return withAnnotation(session, { events: inTimeOrder([...session.annotation.events, event]) });
}

export function editScoreEvent(session: Session, command: EditScoreEvent): Session {
  existing(session, command.index);
  const events = [...session.annotation.events];
  events[command.index] = scoreEvent(session, command.event);
  return withAnnotation(session, { events: inTimeOrder(events) });
}

export function removeScoreEvent(session: Session, command: RemoveScoreEvent): Session {
  existing(session, command.index);
  return withAnnotation(session, { events: session.annotation.events.filter((_, i) => i !== command.index) });
}
