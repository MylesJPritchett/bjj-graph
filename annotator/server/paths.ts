import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, one level above annotator/. */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const vocabPath = (file: string) => join(repoRoot, "vocab", file);

/** Where Annotation files live. Override with ANNOTATIONS_DIR, e.g. for a throwaway try-out. */
export const annotationsDir = resolve(process.env.ANNOTATIONS_DIR ?? join(repoRoot, "annotations"));

export const annotationFile = (id: string) => join(annotationsDir, `${id}.json`);

/** The Athlete registry. Override with ATHLETES_FILE, e.g. to try the tool with the sample registry. */
export const athletesFile = resolve(process.env.ATHLETES_FILE ?? vocabPath("athletes.json"));
