import type { SessionContext } from "../state";
import type { Annotation } from "../types";

/** What a violation is about, so the UI can highlight it. Indexes are into the Annotation's arrays. */
export type ViolationTarget =
  | { kind: "match" }
  | { kind: "athletes" }
  | { kind: "segment"; index: number }
  | { kind: "event"; index: number }
  | { kind: "result" };

export interface Violation {
  /** Stable id of the rule, e.g. "segments-tile-match". */
  rule: string;
  message: string;
  target: ViolationTarget;
}

export type Rule = (annotation: Annotation, context: SessionContext) => Violation[];
