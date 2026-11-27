// Undo and redo. Every other command is recorded by `apply` in session.ts,
// so a new command is undoable without any extra work.

import { reject, type Session, type Snapshot } from "../state";

export interface Undo {
  type: "undo";
}

export interface Redo {
  type: "redo";
}

export type HistoryCommand = Undo | Redo;

const snapshotOf = (session: Session): Snapshot => ({ annotation: session.annotation, bounds: session.bounds });

/** Records `before` as the state to undo back to after a command produced `after`. Discards any redo. */
export function recordChange(before: Session, after: Session): Session {
  return { ...after, history: { past: [...before.history.past, snapshotOf(before)], future: [] } };
}

export function undo(session: Session): Session {
  const { past, future } = session.history;
  const previous = past[past.length - 1];
  if (!previous) reject("Nothing to undo.");
  return { ...session, ...previous, history: { past: past.slice(0, -1), future: [...future, snapshotOf(session)] } };
}

export function redo(session: Session): Session {
  const { past, future } = session.history;
  const next = future[future.length - 1];
  if (!next) reject("Nothing to redo.");
  return { ...session, ...next, history: { past: [...past, snapshotOf(session)], future: future.slice(0, -1) } };
}
