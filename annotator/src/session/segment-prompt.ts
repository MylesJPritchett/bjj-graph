// The keyboard prompt that follows a Position hotkey: it asks how the new Segment
// was reached (Transition type, then Initiator) and who holds its first Role,
// skipping what doesn't apply. Pure: the UI shows `step` and feeds keys to
// `answerSegmentPrompt`; once `step` is undefined, `command` is ready to apply.

import type { StartSegment } from "./commands/segments";
import { apply } from "./session";
import type { Session } from "./state";
import type { AthleteSlug, Position, VideoTime, VocabId } from "./types";

export interface PromptOption {
  key: string;
  label: string;
}

export interface PromptStep {
  kind: "transition_type" | "initiator" | "role_holder";
  question: string;
  options: PromptOption[];
}

export interface SegmentPrompt {
  /** The command built so far; complete once `step` is undefined. */
  readonly command: StartSegment;
  /** The question being asked, or undefined when every answer is in. */
  readonly step?: PromptStep;
  readonly session: Session;
}

/** Athletes are picked by number, in the Match's display order. */
const athleteKeys = ["1", "2"];

export function openSegmentPrompt(
  session: Session,
  at: { time: VideoTime; position_id: VocabId },
): { prompt?: SegmentPrompt; rejection?: string } {
  const command: StartSegment = { type: "start_segment", ...at };
  // Check the timing now, so the annotator isn't asked questions for a Segment that can't start here.
  const { rejection } = apply(session, command);
  if (rejection) return { rejection };
  const position = session.context.vocabulary.positions.find((p) => p.id === at.position_id)!;
  const needsAthletes = session.annotation.segments.length > 0 || !position.symmetric;
  if (needsAthletes && session.annotation.athletes.length < 2) {
    return { rejection: "Pick both Athletes before labelling Transitions and Roles." };
  }
  return { prompt: withNextStep(session, command) };
}

/** Answers the current step with a key. A key that isn't an option leaves the prompt unchanged. */
export function answerSegmentPrompt(prompt: SegmentPrompt, key: string): SegmentPrompt {
  const { step, command, session } = prompt;
  if (!step || !step.options.some((o) => o.key === key)) return prompt;
  switch (step.kind) {
    case "transition_type": {
      const type = session.context.vocabulary.transitions.find((t) => t.hotkey === key)!;
      return withNextStep(session, { ...command, entered_by: { transition_type: type.id } });
    }
    case "initiator":
      return withNextStep(session, { ...command, entered_by: { ...command.entered_by!, initiator: athleteFor(session, key) } });
    case "role_holder":
      return withNextStep(session, { ...command, first_role_holder: athleteFor(session, key) });
  }
}

function athleteFor(session: Session, key: string): AthleteSlug {
  return session.annotation.athletes[athleteKeys.indexOf(key)]!;
}

function withNextStep(session: Session, command: StartSegment): SegmentPrompt {
  const step = nextStep(session, command);
  return step ? { session, command, step } : { session, command };
}

function nextStep(session: Session, command: StartSegment): PromptStep | undefined {
  const { vocabulary } = session.context;
  const position = vocabulary.positions.find((p) => p.id === command.position_id)!;
  const isFirstSegment = session.annotation.segments.length === 0;

  if (!isFirstSegment && !command.entered_by) {
    return {
      kind: "transition_type",
      question: `How was ${position.name} reached?`,
      options: vocabulary.transitions.map((t) => ({ key: t.hotkey, label: t.name })),
    };
  }
  const entered = command.entered_by;
  const type = entered && vocabulary.transitions.find((t) => t.id === entered.transition_type);
  if (type?.takes_initiator && entered!.initiator === undefined) {
    return { kind: "initiator", question: `Who made the ${type.name}?`, options: athleteOptions(session) };
  }
  if (!position.symmetric && command.first_role_holder === undefined) {
    return { kind: "role_holder", question: roleQuestion(position), options: athleteOptions(session) };
  }
  return undefined;
}

function roleQuestion(position: Position): string {
  return `${position.name}: who is the ${position.roles?.[0] ?? "first Role"}?`;
}

function athleteOptions(session: Session): PromptOption[] {
  const { athletes } = session.annotation;
  const { registry } = session.context;
  return athletes.map((slug, i) => ({ key: athleteKeys[i]!, label: registry.athletes[slug]?.name ?? slug }));
}
