// Rules for what each Segment records about how it was reached and who holds it:
// the first-Role holder (by Position symmetry) and the incoming Transition with its
// Initiator (by the Transition type's `takes_initiator`).

import type { Rule, Violation } from "./violation";

const segmentAt = (index: number) => ({ kind: "segment", index }) as const;

/** Asymmetric Positions name the Athlete in the first Role; symmetric Positions name nobody. */
export const roleHolder: Rule = (annotation, { vocabulary }) => {
  const rule = "role-holder";
  const violations: Violation[] = [];
  annotation.segments.forEach((segment, index) => {
    const position = vocabulary.positions.find((p) => p.id === segment.position_id);
    if (!position) return; // reported by known-position
    const holder = segment.first_role_holder;
    const target = segmentAt(index);
    if (position.symmetric) {
      if (holder !== undefined) {
        violations.push({ rule, message: `${position.name} is symmetric, so it has no Role holder.`, target });
      }
    } else if (holder === undefined) {
      const firstRole = position.roles?.[0] ?? "first Role";
      violations.push({ rule, message: `${position.name}: who is the ${firstRole}?`, target });
    } else if (!annotation.athletes.includes(holder)) {
      violations.push({ rule, message: `Role holder "${holder}" isn't one of the Match's Athletes.`, target });
    }
  });
  return violations;
};

/** Every Segment after the first is entered by a known Transition type; the first is entered by none. */
export const transitionRecorded: Rule = (annotation, { vocabulary }) => {
  const rule = "transition";
  const violations: Violation[] = [];
  annotation.segments.forEach((segment, index) => {
    const entered = segment.entered_by;
    const target = segmentAt(index);
    if (index === 0) {
      if (entered) violations.push({ rule, message: "The first Segment starts the Match, so no Transition enters it.", target });
    } else if (!entered) {
      violations.push({ rule, message: "Which Transition entered this Segment?", target });
    } else if (!vocabulary.transitions.some((t) => t.id === entered.transition_type)) {
      violations.push({ rule, message: `Unknown Transition type "${entered.transition_type}".`, target });
    }
  });
  return violations;
};

/** Transitions that take an Initiator name one of the Match's Athletes; Resets name nobody. */
export const initiator: Rule = (annotation, { vocabulary }) => {
  const rule = "initiator";
  const violations: Violation[] = [];
  annotation.segments.forEach((segment, index) => {
    const entered = segment.entered_by;
    const type = entered && vocabulary.transitions.find((t) => t.id === entered.transition_type);
    if (!entered || !type) return; // reported by the transition rule
    const target = segmentAt(index);
    if (!type.takes_initiator) {
      if (entered.initiator !== undefined) {
        violations.push({ rule, message: `A ${type.name} has no Initiator: it's the referee's call.`, target });
      }
    } else if (entered.initiator === undefined) {
      violations.push({ rule, message: `${type.name}: who was the Initiator?`, target });
    } else if (!annotation.athletes.includes(entered.initiator)) {
      violations.push({ rule, message: `Initiator "${entered.initiator}" isn't one of the Match's Athletes.`, target });
    }
  });
  return violations;
};
