import type { Annotation } from "./types";

const KEY_ORDER: (keyof Annotation)[] = [
  "id",
  "schema_version",
  "vocabulary_version",
  "annotator",
  "relabel_of",
  "source",
  "match",
  "metadata",
  "athletes",
  "segments",
  "events",
  "result",
];

/** Puts the top-level keys in schema order so saved files diff cleanly. */
export function canonicalOrder(annotation: Annotation): Annotation {
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) if (annotation[key] !== undefined) out[key] = annotation[key];
  return out as unknown as Annotation;
}

/** The exact text written to annotations/<id>.json. */
export function toJson(annotation: Annotation): string {
  return JSON.stringify(canonicalOrder(annotation), null, 2) + "\n";
}

export function fromJson(text: string): Annotation {
  return JSON.parse(text) as Annotation;
}
