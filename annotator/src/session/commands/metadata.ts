// Match metadata and the source's licence / permission status.

import { reject, withAnnotation, type Session } from "../state";
import type { Metadata, Source } from "../types";

export interface SetMetadata {
  type: "set_metadata";
  /** The whole metadata record; replaces the old one. Blank text fields are dropped. */
  metadata: Metadata;
}

export interface SetLicence {
  type: "set_licence";
  licence_status: Source["licence_status"];
  /** A blank note removes any old one. */
  licence_note?: string;
}

export type MetadataCommand = SetMetadata | SetLicence;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Trimmed text, or undefined when blank. */
const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/** Copies the defined entries only, so blank fields leave no key behind. */
function defined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

export function setMetadata(session: Session, command: SetMetadata): Session {
  const m = command.metadata;
  const ruleset = text(m.ruleset);
  if (ruleset !== undefined && !SLUG.test(ruleset)) reject(`The ruleset must be a kebab-case id, e.g. "adcc" (got "${ruleset}").`);
  const camera = m.camera && defined({ type: m.camera.type, angle: text(m.camera.angle) });
  const metadata: Metadata = defined({
    event: text(m.event),
    bracket: text(m.bracket),
    round: text(m.round),
    ruleset,
    gi: m.gi,
    weight_class: text(m.weight_class),
    level: text(m.level),
    camera: camera && Object.keys(camera).length ? camera : undefined,
    resolution: text(m.resolution),
  });
  return withAnnotation(session, { metadata });
}

export function setLicence(session: Session, command: SetLicence): Session {
  const { licence_note: _old, ...source } = session.annotation.source;
  const note = text(command.licence_note);
  return withAnnotation(session, {
    source: { ...source, licence_status: command.licence_status, ...(note ? { licence_note: note } : {}) },
  });
}
