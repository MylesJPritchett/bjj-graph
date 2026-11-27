// The annotation session module: pure TypeScript, no DOM.
// Commands go in (`apply`); the Annotation and its violations come out.

import { handlers, isHistoryCommand, recordChange, type Command } from "./commands";
import { CommandRejected, NO_HISTORY, type Session, type SessionContext } from "./state";
import { canonicalOrder } from "./serialize";
import type { Annotation, AthleteRegistry, Source } from "./types";
import { validate, type Violation } from "./validation";

export type { Session, SessionContext } from "./state";
export type { Command } from "./commands";
export type { Violation } from "./validation";

export const SCHEMA_VERSION = 1;

export interface NewAnnotation {
  id: string;
  annotator: string;
  source: Source;
}

/** Starts a new, empty Annotation of a Match from its source. */
export function newSession(context: SessionContext, init: NewAnnotation): Session {
  const annotation: Annotation = {
    id: init.id,
    schema_version: SCHEMA_VERSION,
    vocabulary_version: context.vocabulary.version,
    annotator: init.annotator,
    source: init.source,
    metadata: {},
    athletes: [],
    segments: [],
    events: [],
  };
  return { context, annotation, bounds: {}, history: NO_HISTORY };
}

/** Reopens a saved Annotation. */
export function openSession(context: SessionContext, annotation: Annotation): Session {
  const bounds = annotation.match ? { start: annotation.match.start_offset, end: annotation.match.end_offset } : {};
  return { context, annotation, bounds, history: NO_HISTORY };
}

/** The same session against an updated Athlete registry, e.g. after adding an Athlete mid-Match. */
export function withRegistry(session: Session, registry: AthleteRegistry): Session {
  return { ...session, context: { ...session.context, registry } };
}

export interface Outcome {
  session: Session;
  /** Set when the command was refused; `session` is then the unchanged input. */
  rejection?: string;
}

export function apply(session: Session, command: Command): Outcome {
  const handler = handlers[command.type] as (s: Session, c: Command) => Session;
  try {
    const handled = handler(session, command);
    const next = { ...handled, annotation: canonicalOrder(handled.annotation) };
    return { session: isHistoryCommand(command) ? next : recordChange(session, next) };
  } catch (error) {
    if (error instanceof CommandRejected) return { session, rejection: error.message };
    throw error;
  }
}

/** Every completeness and consistency problem in the session's Annotation. */
export function violationsOf(session: Session): Violation[] {
  return validate(session.annotation, session.context);
}
