import type { Rule } from "./violation";

/** Every Segment's Position exists in the vocabulary. */
export const knownPosition: Rule = (annotation, { vocabulary }) => {
  const known = new Set(vocabulary.positions.map((p) => p.id));
  return annotation.segments.flatMap((segment, index) =>
    known.has(segment.position_id)
      ? []
      : [
          {
            rule: "known-position",
            message: `Unknown Position "${segment.position_id}".`,
            target: { kind: "segment", index } as const,
          },
        ],
  );
};

/** Both Athletes are picked. */
export const twoAthletes: Rule = ({ athletes }) =>
  athletes.length === 2
    ? []
    : [{ rule: "two-athletes", message: "Pick both Athletes.", target: { kind: "athletes" } }];

/** Every Athlete exists in the registry. */
export const knownAthletes: Rule = ({ athletes }, { registry }) =>
  athletes
    .filter((slug) => !(slug in registry.athletes))
    .map((slug) => ({
      rule: "known-athletes",
      message: `Athlete "${slug}" isn't in the registry.`,
      target: { kind: "athletes" } as const,
    }));
