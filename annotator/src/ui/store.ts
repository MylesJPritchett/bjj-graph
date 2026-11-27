// UI state: the current session plus transient messages. All Annotation
// changes go through `dispatch`, which runs a session command.

import {
  apply,
  violationsOf,
  withRegistry,
  type Command,
  type Session,
  type SessionContext,
  type Violation,
} from "../session/session";
import type { AthleteRegistry } from "../session/types";

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
    const applied = apply(session, command);
    if (applied.rejection) {
      this.notify({ kind: "error", text: applied.rejection });
      return false;
    }
    this.set({ session: applied.session, violations: violationsOf(applied.session), dirty: true, notice: undefined });
    return true;
  }

  /** Replaces the whole session, e.g. after creating or opening an Annotation. */
  open(session: Session, dirty = false) {
    this.set({ session, violations: violationsOf(session), dirty, notice: undefined });
  }

  /** Swaps in the registry after an Athlete was added, so they can be picked straight away. */
  updateRegistry(registry: AthleteRegistry) {
    const context = { ...this.state.context, registry };
    const session = this.state.session && withRegistry(this.state.session, registry);
    this.set({ context, session, violations: session ? violationsOf(session) : [] });
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
