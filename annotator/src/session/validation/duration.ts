import type { Rule } from "./violation";

/** The Label Guide's establishment rule: a Position counts only once held for 3s. */
export const MINIMUM_SEGMENT_SECONDS = 3;

/** Every Segment lasts at least the minimum duration. */
export const minimumDuration: Rule = ({ segments }) =>
  segments.flatMap((segment, index) => {
    const duration = segment.end - segment.start;
    return duration > 0 && duration < MINIMUM_SEGMENT_SECONDS
      ? [
          {
            rule: "minimum-duration",
            message: `Held for ${Math.round(duration * 100) / 100}s, under the ${MINIMUM_SEGMENT_SECONDS}s minimum: fold it into Scramble or a neighbour.`,
            target: { kind: "segment", index } as const,
          },
        ]
      : [];
  });
