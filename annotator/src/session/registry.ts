// Adding Athletes to the Athlete registry. Pure: shared by the tool and the
// dev server, which re-checks the result against vocab/athletes.schema.json.

import type { AthleteEntry, AthleteRegistry, AthleteSlug } from "./types";

/** Lowercase kebab-case, as vocab/athletes.schema.json requires. */
export const ATHLETE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINK_SITE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export interface NewAthlete {
  slug: AthleteSlug;
  name: string;
  /** External profiles keyed by site, e.g. "bjjheroes", "digitsu". */
  links?: Record<string, string>;
}

export interface RegistryOutcome {
  registry: AthleteRegistry;
  /** Set when the Athlete was refused; `registry` is then the unchanged input. */
  rejection?: string;
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function problemWith(registry: AthleteRegistry, athlete: NewAthlete): string | undefined {
  const { slug, name, links = {} } = athlete;
  if (!ATHLETE_SLUG.test(slug)) return `"${slug}" isn't a valid Athlete slug: use lowercase kebab-case, e.g. "gordon-ryan".`;
  const holder = registry.athletes[slug];
  if (holder) return `The slug "${slug}" is already taken by ${holder.name}. Pick a different slug.`;
  if (!name.trim()) return "Give the Athlete a display name.";
  for (const [site, url] of Object.entries(links)) {
    if (!LINK_SITE.test(site)) return `"${site}" isn't a valid link site: use lowercase snake_case, e.g. "bjjheroes".`;
    if (!isWebUrl(url)) return `The ${site} link "${url}" isn't an http(s) URL.`;
  }
  return undefined;
}

/** Adds a new Athlete. Slugs are unique: a taken slug is refused, never overwritten. */
export function addAthlete(registry: AthleteRegistry, athlete: NewAthlete): RegistryOutcome {
  const rejection = problemWith(registry, athlete);
  if (rejection) return { registry, rejection };
  const entry: AthleteEntry = { name: athlete.name.trim() };
  if (athlete.links && Object.keys(athlete.links).length > 0) entry.links = { ...athlete.links };
  return { registry: { ...registry, athletes: { ...registry.athletes, [athlete.slug]: entry } } };
}

/** A slug suggestion for a display name, e.g. "João Rocha" -> "joao-rocha". */
export function suggestSlug(name: string): AthleteSlug {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
