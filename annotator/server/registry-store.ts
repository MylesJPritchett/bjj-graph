// Writes new Athletes to the Athlete registry file. Node only.

import { readFile, rename, writeFile } from "node:fs/promises";
import { addAthlete, type NewAthlete } from "../src/session/registry";
import type { AthleteRegistry } from "../src/session/types";
import { StoreError } from "./annotation-store";
import { registrySchemaErrors } from "./schema";

function asNewAthlete(body: unknown): NewAthlete {
  const { slug, name, links } = (body ?? {}) as Record<string, unknown>;
  const linksOk =
    links === undefined ||
    (typeof links === "object" && links !== null && Object.values(links).every((v) => typeof v === "string"));
  if (typeof slug !== "string" || typeof name !== "string" || !linksOk) {
    throw new StoreError(400, "An Athlete needs a slug and a display name, plus optional links of site to URL.");
  }
  return { slug, name, links: links as Record<string, string> | undefined };
}

/** Slugs in alphabetical order, so each addition is a small diff. */
function sorted(registry: AthleteRegistry): AthleteRegistry {
  const slugs = Object.keys(registry.athletes).sort();
  return { ...registry, athletes: Object.fromEntries(slugs.map((s) => [s, registry.athletes[s]!])) };
}

/**
 * Adds one Athlete to the registry file and returns the new registry.
 * A taken slug is refused (409) and anything the registry format rejects is
 * refused (400/422); a refused Athlete leaves the file untouched.
 */
export async function addAthleteToRegistry(file: string, body: unknown): Promise<AthleteRegistry> {
  const athlete = asNewAthlete(body);
  const current = JSON.parse(await readFile(file, "utf8")) as AthleteRegistry;
  const outcome = addAthlete(current, athlete);
  if (outcome.rejection) {
    const status = athlete.slug in current.athletes ? 409 : 400;
    throw new StoreError(status, outcome.rejection);
  }
  const registry = sorted(outcome.registry);
  const errors = registrySchemaErrors(registry);
  if (errors.length > 0) throw new StoreError(422, "The registry wouldn't match its format.", errors);
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(registry, null, 2) + "\n", "utf8");
  await rename(temporary, file);
  return registry;
}
