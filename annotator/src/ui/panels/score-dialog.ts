// The Score Event dialog: records a new Score Event at the playhead, or edits
// or deletes an existing one (opened from its timeline marker).

import type { ScoreEventFields } from "../../session/commands/events";
import type { ScoreEvent } from "../../session/types";
import { formatTime, h } from "../dom";
import type { Store } from "../store";

export const SCORE_TYPES: { id: ScoreEvent["score_type"]; label: string }[] = [
  { id: "points", label: "Points" },
  { id: "advantage", label: "Advantage" },
  { id: "penalty", label: "Penalty" },
  { id: "submission_finish", label: "Submission finish" },
  { id: "submission_attempt", label: "Scored submission attempt" },
];

export interface ScoreDialog {
  /** Opens the dialog for a new Score Event at `time`. */
  add(time: number): void;
  /** Opens the dialog on the Event at `index` in `annotation.events`. */
  edit(index: number): void;
}

export function mountScoreDialog(root: HTMLElement, store: Store): ScoreDialog {
  const heading = h("h3");
  const time = h("input", { type: "number", step: "0.01", min: "0", required: true });
  const athlete = h("select");
  const scoreType = h(
    "select",
    {},
    ...SCORE_TYPES.map((t, i) => h("option", { value: t.id }, `${i + 1}. ${t.label}`)),
  );
  const value = h("input", { type: "number", step: "1", placeholder: "e.g. 2", size: 6 });
  const note = h("input", { type: "text", size: 30 });
  const remove = h("button", { type: "button", class: "danger" }, "Delete");
  const cancel = h("button", { type: "button" }, "Cancel");
  const form = h(
    "form",
    { method: "dialog" },
    heading,
    h("label", {}, "Time (s) ", time),
    h("label", {}, "Athlete ", athlete),
    h("label", {}, "Type ", scoreType),
    h("label", {}, "Value ", value),
    h("label", {}, "Note ", note),
    h("p", { class: "hint" }, "Enter saves, Esc cancels. In the Type list, digits 1-5 pick a type."),
    h("div", { class: "row" }, h("button", { type: "submit" }, "Save"), remove, cancel),
  );
  const dialog = h("dialog", { class: "score-dialog" }, form);
  root.append(dialog);

  /** The Event being edited, or undefined when adding. */
  let editing: number | undefined;

  function fillAthletes(selected?: string) {
    const athletes = store.state.session?.annotation.athletes ?? [];
    const { registry } = store.state.context;
    athlete.replaceChildren(
      ...athletes.map((slug) => h("option", { value: slug }, registry.athletes[slug]?.name ?? slug)),
    );
    if (selected) athlete.value = selected;
  }

  function show(fields: Partial<ScoreEventFields>, index?: number) {
    const session = store.state.session;
    if (!session) return store.notify({ kind: "error", text: "Open or create an Annotation first." });
    if (session.annotation.athletes.length < 2) return store.notify({ kind: "error", text: "Pick both Athletes first." });
    editing = index;
    heading.textContent = index === undefined ? "New Score Event" : `Score Event ${index + 1}`;
    time.value = String(fields.time ?? 0);
    fillAthletes(fields.athlete);
    scoreType.value = fields.score_type ?? "points";
    value.value = fields.value === undefined ? "" : String(fields.value);
    note.value = fields.note ?? "";
    remove.hidden = index === undefined;
    dialog.showModal();
    athlete.focus();
  }

  function save() {
    const fields: ScoreEventFields = {
      time: Number(time.value),
      athlete: athlete.value,
      score_type: scoreType.value as ScoreEvent["score_type"],
      value: value.value.trim() === "" ? undefined : Number(value.value),
      note: note.value,
    };
    const ok =
      editing === undefined
        ? store.dispatch({ type: "add_score_event", ...fields })
        : store.dispatch({ type: "edit_score_event", index: editing, event: fields });
    if (ok) dialog.close();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    save();
  });
  // Enter saves from any field, selects included.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      save();
    } else if (event.target === scoreType && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      scoreType.value = SCORE_TYPES[Number(event.key) - 1]!.id;
    }
  });
  cancel.addEventListener("click", () => dialog.close());
  remove.addEventListener("click", () => {
    if (editing !== undefined && store.dispatch({ type: "remove_score_event", index: editing })) dialog.close();
  });

  return {
    add: (t) => show({ time: t }),
    edit: (index) => {
      const event = store.state.session?.annotation.events[index];
      if (event) show(event, index);
    },
  };
}

/** One-line description of a Score Event, for marker tooltips. */
export function describeScoreEvent(event: ScoreEvent, name: string): string {
  const type = SCORE_TYPES.find((t) => t.id === event.score_type)?.label ?? event.score_type;
  return `${formatTime(event.time)}  ${name}: ${type}${event.value === undefined ? "" : ` ${event.value}`}${event.note ? ` (${event.note})` : ""}`;
}
