import type { Annotation, AthleteRegistry, VideoTime, Vocabulary } from "./types";

/** The shared data a session validates against. */
export interface SessionContext {
  vocabulary: Vocabulary;
  registry: AthleteRegistry;
}

/** An immutable snapshot of one Annotation being edited. */
export interface Session {
  readonly context: SessionContext;
  readonly annotation: Annotation;
  /**
   * Match offsets set so far. `annotation.match` only exists once both are set,
   * because the schema needs both together.
   */
  readonly bounds: { readonly start?: VideoTime; readonly end?: VideoTime };
}

/** Thrown by a command handler to refuse a command; the session stays unchanged. */
export class CommandRejected extends Error {}

export function reject(reason: string): never {
  throw new CommandRejected(reason);
}

export function withAnnotation(session: Session, changes: Partial<Annotation>): Session {
  return { ...session, annotation: { ...session.annotation, ...changes } };
}

export function positionById(session: Session, id: string) {
  return session.context.vocabulary.positions.find((p) => p.id === id);
}
