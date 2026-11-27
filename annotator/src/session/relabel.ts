// Blind re-labelling: a fresh Annotation of a Match that was already
// annotated, linked to the original by `relabel_of`. It carries only what
// identifies the Match (source, Match bounds, metadata, Athletes), never the
// original's Segments, Events or Result, so the re-label stays blind.

import { newSession } from "./session";
import { CommandRejected, reject, type Session, type SessionContext } from "./state";
import type { Annotation } from "./types";

export interface NewRelabel {
  id: string;
  annotator: string;
}

export interface RelabelOutcome {
  session?: Session;
  /** Set when the re-label can't be started. */
  rejection?: string;
}

/** Starts a blind re-label of `original`, ready to label from the Match start. */
export function startRelabel(context: SessionContext, original: Annotation, init: NewRelabel): RelabelOutcome {
  try {
    return { session: relabelSession(context, original, init) };
  } catch (error) {
    if (error instanceof CommandRejected) return { rejection: error.message };
    throw error;
  }
}

function relabelSession(context: SessionContext, original: Annotation, init: NewRelabel): Session {
  const { match } = original;
  if (!match) reject(`Set the Match start and end in "${original.id}" before re-labelling it.`);
  if (init.id === original.id) reject("A re-label needs its own Annotation id.");

  const fresh = newSession(context, { id: init.id, annotator: init.annotator, source: structuredClone(original.source) });
  const annotation: Annotation = {
    ...fresh.annotation,
    // A re-label of a re-label still points at the original Annotation.
    relabel_of: original.relabel_of ?? original.id,
    match: { ...match },
    metadata: structuredClone(original.metadata),
    athletes: [...original.athletes],
  };
  return { ...fresh, annotation, bounds: { start: match.start_offset, end: match.end_offset } };
}

/** `<original>-relabel`, or `<original>-relabel-<n>` when that id is taken. */
export function suggestRelabelId(originalId: string, existingIds: readonly string[]): string {
  const taken = new Set(existingIds);
  const base = `${originalId}-relabel`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
