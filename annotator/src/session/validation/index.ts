// Validation: a pure function of the Annotation plus the vocabulary and registry.
// To add a rule, write it in a file in this folder and add it to `rules`.

import type { SessionContext } from "../state";
import type { Annotation } from "../types";
import { knownAthletes, knownPosition, twoAthletes } from "./known-ids";
import { resultPresent, scoreEventInMatch, submissionFinish } from "./scoring";
import { matchBoundsSet, segmentsTileMatch } from "./timeline";
import type { Rule, Violation } from "./violation";

export type { Rule, Violation, ViolationTarget } from "./violation";

export const rules: Rule[] = [
  // Match and Athletes
  matchBoundsSet,
  twoAthletes,
  knownAthletes,
  // Segments
  segmentsTileMatch,
  knownPosition,
  // Score Events and Result
  scoreEventInMatch,
  resultPresent,
  submissionFinish,
];

export function validate(annotation: Annotation, context: SessionContext): Violation[] {
  return rules.flatMap((rule) => rule(annotation, context));
}
