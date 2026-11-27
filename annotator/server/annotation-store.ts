// Reads and writes Annotation files and the shared data in the repo. Node only.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { toJson } from "../src/session/serialize";
import type { Annotation } from "../src/session/types";
import { annotationFile, annotationsDir, athletesFile, vocabPath } from "./paths";
import { schemaErrors } from "./schema";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class StoreError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

function fileFor(id: string): string {
  if (!SLUG.test(id)) throw new StoreError(400, `"${id}" is not a valid Annotation id (lowercase kebab-case).`);
  return annotationFile(id);
}

export async function readVocabulary(): Promise<unknown> {
  return JSON.parse(await readFile(vocabPath("vocabulary.json"), "utf8"));
}

export async function readRegistry(): Promise<unknown> {
  return JSON.parse(await readFile(athletesFile, "utf8"));
}

export async function listAnnotations(): Promise<string[]> {
  const names = await readdir(annotationsDir).catch(() => [] as string[]);
  return names
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.slice(0, -".json".length))
    .sort();
}

export async function readAnnotation(id: string): Promise<string> {
  try {
    return await readFile(fileFor(id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StoreError(404, `No Annotation "${id}".`);
    throw error;
  }
}

/** Writes annotations/<id>.json after checking it against the Annotation JSON Schema. */
export async function writeAnnotation(id: string, document: unknown): Promise<void> {
  const file = fileFor(id);
  const errors = schemaErrors(document);
  if (errors.length > 0) throw new StoreError(422, "The Annotation doesn't match the schema.", errors);
  if ((document as Annotation).id !== id) throw new StoreError(400, `The document's id doesn't match "${id}".`);
  await mkdir(annotationsDir, { recursive: true });
  await writeFile(file, toJson(document as Annotation), "utf8");
}
