import type { Rule, Violation } from "./violation";

const segmentAt = (index: number) => ({ kind: "segment", index }) as const;

/** A Position must be held at least this long to count as a Segment (Label Guide: the 3s establishment rule). */
export const MINIMUM_SEGMENT_SECONDS = 3;

/**
 * Every Segment lasts at least 3s. A short final submission Segment is still
 * flagged: the Label Guide asks for a note that it was deliberate.
 */
export const minimumDuration: Rule = ({ segments }) =>
  segments.flatMap((segment, index) => {
    const length = segment.end - segment.start;
    // Segments that end before they start are reported by segments-tile-match.
    if (length <= 0 || length >= MINIMUM_SEGMENT_SECONDS) return [];
    return [
      {
        rule: "minimum-duration",
        message: `Held ${Math.round(length * 100) / 100}s, under the ${MINIMUM_SEGMENT_SECONDS}s minimum: fold it into a neighbour or Scramble.`,
        target: segmentAt(index),
      },
    ];
  });

/**
 * Adjacent Segments differ in Position or Role holder; otherwise nothing happened
 * and the earlier Segment simply continues. The same Position either side of a
 * Reset is expected.
 */
export const adjacentSegmentsDiffer: Rule = ({ segments }) =>
  segments.flatMap((segment, index) => {
    const previous = segments[index - 1];
    if (!previous || segment.entered_by?.transition_type === "reset") return [];
    if (segment.position_id !== previous.position_id || segment.first_role_holder !== previous.first_role_holder) {
      return [];
    }
    return [
      {
        rule: "adjacent-duplicate",
        message: "Same Position and Role holder as the Segment before it: merge them.",
        target: segmentAt(index),
      },
    ];
  });

/** The Match bounds are set. */
export const matchBoundsSet: Rule = (annotation) =>
  annotation.match
    ? []
    : [{ rule: "match-bounds-set", message: "Set the Match start and end offsets.", target: { kind: "match" } }];

/** Segments are ordered and contiguous from the Match start offset to the end offset. */
export const segmentsTileMatch: Rule = ({ match, segments }) => {
  const rule = "segments-tile-match";
  if (!match) {
    return segments.length > 0
      ? [{ rule, message: "There are Segments but no Match bounds.", target: { kind: "match" } }]
      : [];
  }
  if (segments.length === 0) return [{ rule, message: "No Segments labelled yet.", target: { kind: "match" } }];

  const violations: Violation[] = [];
  segments.forEach((segment, index) => {
    const target = segmentAt(index);
    if (segment.end <= segment.start) {
      violations.push({ rule, message: `Segment ends (${segment.end}s) before it starts (${segment.start}s).`, target });
    }
    const previous = segments[index - 1];
    if (!previous) {
      if (segment.start !== match.start_offset) {
        violations.push({
          rule,
          message: `First Segment starts at ${segment.start}s, not at the Match start (${match.start_offset}s).`,
          target,
        });
      }
    } else if (segment.start > previous.end) {
      violations.push({ rule, message: `Gap from ${previous.end}s to ${segment.start}s before this Segment.`, target });
    } else if (segment.start < previous.end) {
      violations.push({
        rule,
        message: `Overlaps the previous Segment from ${segment.start}s to ${previous.end}s.`,
        target,
      });
    }
  });
  const lastIndex = segments.length - 1;
  const last = segments[lastIndex]!;
  if (last.end !== match.end_offset) {
    violations.push({
      rule,
      message: `Last Segment ends at ${last.end}s, not at the Match end (${match.end_offset}s).`,
      target: segmentAt(lastIndex),
    });
  }
  return violations;
};
