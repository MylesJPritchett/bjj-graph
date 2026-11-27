// Score Events: the scoring track, kept apart from Segments (ADR-0001).

import { reject, withAnnotation, type Session } from "../state";
import type { MatchEvent, ScoreEvent } from "../types";

/** A Score Event's fields, without its `kind`. */
export type ScoreEventFields = Omit<ScoreEvent, "kind">;
type OptionalField = { [K in keyof ScoreEventFields]-?: undefined extends ScoreEventFields[K] ? K : never }[keyof ScoreEventFields];

export interface AddScoreEvent extends ScoreEventFields {
  type: "add_score_event";
}

export interface EditScoreEvent {
  type: "edit_score_event";
  /** Index into `annotation.events`. */
  event: number;
  /** Fields to change. `null` clears an optional field; fields left out are kept. */
  set: { [K in keyof ScoreEventFields]?: K extends OptionalField ? ScoreEventFields[K] | null : ScoreEventFields[K] };
}

export interface DeleteScoreEvent {
  type: "delete_score_event";
  event: number;
}

export type EventCommand = AddScoreEvent | EditScoreEvent | DeleteScoreEvent;

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
  if (!event) reject(`There is no Event ${index + 1}.`);
  return event;
}

export function addScoreEvent(session: Session, command: AddScoreEvent): Session {
  const { type: _type, ...fields } = command;
  const event = scoreEvent(session, fields);
  return withAnnotation(session, { events: inTimeOrder([...session.annotation.events, event]) });
}

export function editScoreEvent(session: Session, command: EditScoreEvent): Session {
  const { kind: _kind, ...current } = existing(session, command.event);
  const edited: Record<string, unknown> = { ...current };
  for (const [field, value] of Object.entries(command.set)) {
    if (value === undefined) continue;
    if (value === null) delete edited[field];
    else edited[field] = value;
  }
  const events = [...session.annotation.events];
  events[command.event] = scoreEvent(session, edited as unknown as ScoreEventFields);
  return withAnnotation(session, { events: inTimeOrder(events) });
}

export function deleteScoreEvent(session: Session, command: DeleteScoreEvent): Session {
  existing(session, command.event);
  return withAnnotation(session, { events: session.annotation.events.filter((_, i) => i !== command.event) });
}
