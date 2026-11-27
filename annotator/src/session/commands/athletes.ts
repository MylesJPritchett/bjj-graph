import { reject, withAnnotation, type Session } from "../state";
import type { AthleteSlug } from "../types";

export interface SetAthletes {
  type: "set_athletes";
  /** Up to two Athlete slugs from the registry, in display order. */
  athletes: AthleteSlug[];
}

export type AthleteCommand = SetAthletes;

export function setAthletes(session: Session, command: SetAthletes): Session {
  const { athletes } = command;
  if (athletes.length > 2) reject("A Match has two Athletes.");
  if (new Set(athletes).size !== athletes.length) reject("Pick two different Athletes.");
  for (const slug of athletes) {
    if (!(slug in session.context.registry.athletes)) reject(`Athlete "${slug}" isn't in the registry.`);
  }
  return withAnnotation(session, { athletes: [...athletes] });
}
