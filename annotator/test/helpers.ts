import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AthleteRegistry, Vocabulary } from "../src/session/types";
import type { SessionContext } from "../src/session/session";

const vocabDir = fileURLToPath(new URL("../../vocab/", import.meta.url));

export function readVocabJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(vocabDir + relativePath, "utf8")) as T;
}

export function readVocabText(relativePath: string): string {
  return readFileSync(vocabDir + relativePath, "utf8");
}

/** The real vocabulary plus the fictional sample Athlete registry. */
export function sampleContext(): SessionContext {
  return {
    vocabulary: readVocabJson<Vocabulary>("vocabulary.json"),
    registry: readVocabJson<AthleteRegistry>("examples/sample-athletes.json"),
  };
}
