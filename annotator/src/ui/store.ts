// UI state: the current session plus transient messages. All Annotation
// changes go through `dispatch`, which runs a session command.

import { apply, violationsOf, type Command, type Session, type SessionContext, type Violation } from "../session/session";

export interface Notice {
  kind: "error" | "info";
  text: string;
}

export interface AppState {
  context: SessionContext;
  session: Session | null;
  violations: Violation[];
  /** True when the session has changes not yet saved. */
  dirty: boolean;
  notice?: Notice;
}

type Listener = (state: AppState) => void;

export class Store {
  private listeners = new Set<Listener>();
  state: AppState;

  constructor(context: SessionContext) {
    this.state = { context, session: null, violations: [], dirty: false };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Runs a session command. A rejected command shows its reason and changes nothing. */
  dispatch(command: Command): boolean {
    const { session } = this.state;
    if (!session) {
      this.notify({ kind: "error", text: "Open or create an Annotation first." });
      return false;
    }
    const outcome = apply(session, command);
    if (outcome.rejection) {
      this.notify({ kind: "error", text: outcome.rejection });
      return false;
    }
    this.set({ session: outcome.session, violations: violationsOf(outcome.session), dirty: true, notice: undefined });
    return true;
  }

  /** Replaces the whole session, e.g. after creating or opening an Annotation. */
  open(session: Session, dirty = false) {
    this.set({ session, violations: violationsOf(session), dirty, notice: undefined });
  }

  markSaved() {
    this.set({ dirty: false });
  }

  notify(notice: Notice | undefined) {
    this.set({ notice });
  }

  private set(changes: Partial<AppState>) {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener(this.state);
  }
}
