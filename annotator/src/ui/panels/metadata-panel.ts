// The Match metadata form, plus the source's licence / permission status.
// Each change sends the whole form as one command.

import type { Metadata, Source } from "../../session/types";
import { h } from "../dom";
import type { Store } from "../store";

const LICENCE_STATUSES: { id: Source["licence_status"]; label: string }[] = [
  { id: "unknown", label: "Not checked yet" },
  { id: "official-channel", label: "Official channel" },
  { id: "permission-granted", label: "Permission granted" },
  { id: "own-footage", label: "Own footage" },
];

const CAMERA_TYPES = ["broadcast", "fixed", "handheld", "other"] as const;

export function mountMetadataPanel(root: HTMLElement, store: Store) {
  const text = (placeholder: string, size = 14) => h("input", { type: "text", placeholder, size });
  const event = text("ADCC 2022");
  const bracket = text("men -88kg");
  const round = text("quarter-final");
  const ruleset = text("adcc", 10);
  const gi = h(
    "select",
    {},
    h("option", { value: "" }, "?"),
    h("option", { value: "false" }, "No-gi"),
    h("option", { value: "true" }, "Gi"),
  );
  const weightClass = text("-88kg", 8);
  const level = text("elite", 10);
  const cameraType = h(
    "select",
    {},
    h("option", { value: "" }, "?"),
    ...CAMERA_TYPES.map((t) => h("option", { value: t }, t)),
  );
  const cameraAngle = text("side, elevated");
  const resolution = text("1080p", 8);
  const licence = h("select", {}, ...LICENCE_STATUSES.map((s) => h("option", { value: s.id }, s.label)));
  const licenceNote = text("where the footage is published, or who agreed", 30);

  const metadataFields = [event, bracket, round, ruleset, gi, weightClass, level, cameraType, cameraAngle, resolution];

  function formMetadata(): Metadata {
    return {
      event: event.value,
      bracket: bracket.value,
      round: round.value,
      ruleset: ruleset.value,
      gi: gi.value === "" ? undefined : gi.value === "true",
      weight_class: weightClass.value,
      level: level.value,
      camera: {
        type: cameraType.value === "" ? undefined : (cameraType.value as (typeof CAMERA_TYPES)[number]),
        angle: cameraAngle.value,
      },
      resolution: resolution.value,
    };
  }

  for (const field of metadataFields) {
    field.addEventListener("change", () => {
      if (!store.dispatch({ type: "set_metadata", metadata: formMetadata() })) render();
    });
  }
  for (const field of [licence, licenceNote]) {
    field.addEventListener("change", () => {
      const ok = store.dispatch({
        type: "set_licence",
        licence_status: licence.value as Source["licence_status"],
        licence_note: licenceNote.value,
      });
      if (!ok) render();
    });
  }

  root.append(
    h("h3", {}, "Match metadata"),
    h(
      "div",
      { class: "row" },
      h("label", {}, "Event ", event),
      h("label", {}, "Bracket ", bracket),
      h("label", {}, "Round ", round),
      h("label", {}, "Ruleset ", ruleset),
      h("label", {}, "Gi / no-gi ", gi),
      h("label", {}, "Weight class ", weightClass),
      h("label", {}, "Level ", level),
    ),
    h(
      "div",
      { class: "row" },
      h("label", {}, "Camera ", cameraType),
      h("label", {}, "Angle ", cameraAngle),
      h("label", {}, "Resolution ", resolution),
      h("label", {}, "Licence / permission ", licence),
      h("label", {}, "Note ", licenceNote),
    ),
  );

  function render() {
    const annotation = store.state.session?.annotation;
    const m = annotation?.metadata ?? {};
    event.value = m.event ?? "";
    bracket.value = m.bracket ?? "";
    round.value = m.round ?? "";
    ruleset.value = m.ruleset ?? "";
    gi.value = m.gi === undefined ? "" : String(m.gi);
    weightClass.value = m.weight_class ?? "";
    level.value = m.level ?? "";
    cameraType.value = m.camera?.type ?? "";
    cameraAngle.value = m.camera?.angle ?? "";
    resolution.value = m.resolution ?? "";
    licence.value = annotation?.source.licence_status ?? "unknown";
    licenceNote.value = annotation?.source.licence_note ?? "";
    for (const field of [...metadataFields, licence, licenceNote]) field.disabled = !annotation;
  }
  store.subscribe(render);
}
