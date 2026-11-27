// The Segment editor: changes the selected Segment's Position, Role holder and
// incoming Transition (type and Initiator), or deletes it. Every change is one
// session command, so each is undoable.

import type { EditSegment } from "../../session/commands/editing";
import type { Session } from "../../session/session";
import type { Segment, Transition } from "../../session/types";
import { formatTime, h } from "../dom";
import type { Store } from "../store";
import type { SegmentSelection } from "../timeline/selection";

const NONE = "";

function options(select: HTMLSelectElement, noneLabel: string, items: { value: string; label: string }[], current: string | undefined) {
  select.replaceChildren(
    h("option", { value: NONE }, noneLabel),
    ...items.map((item) => h("option", { value: item.value }, item.label)),
  );
  select.value = current ?? NONE;
}

export function mountSegmentEditor(root: HTMLElement, store: Store, selection: SegmentSelection) {
  const { vocabulary, registry } = store.state.context;
  const heading = h("h3");
  const position = h("select");
  const roleHolder = h("select");
  const roleLabel = h("span");
  const transitionType = h("select");
  const initiator = h("select");
  const transitionRow = h(
    "div",
    { class: "row" },
    h("label", {}, "Entered by ", transitionType),
    h("label", {}, "Initiator ", initiator),
  );
  const body = h(
    "div",
    {},
    h("div", { class: "row" }, h("label", {}, "Position ", position), h("label", {}, roleLabel, roleHolder)),
    transitionRow,
    h(
      "div",
      { class: "row" },
      h("button", { onclick: () => remove("previous") }, "Delete (previous absorbs)"),
      h("button", { onclick: () => remove("next") }, "Delete (next absorbs)"),
      h("button", { onclick: () => selection.set(null) }, "Close"),
    ),
  );
  root.append(heading, body);

  const selected = (): { session: Session; index: number; segment: Segment } | undefined => {
    const session = store.state.session;
    const index = selection.get();
    const segment = index === null ? undefined : session?.annotation.segments[index];
    return session && segment && index !== null ? { session, index, segment } : undefined;
  };

  const edit = (set: EditSegment["set"]) => {
    const current = selected();
    if (current && !store.dispatch({ type: "edit_segment", segment: current.index, set })) render();
  };

  function remove(absorbedBy: "previous" | "next") {
    const current = selected();
    if (current && store.dispatch({ type: "delete_segment", segment: current.index, absorbed_by: absorbedBy })) {
      selection.set(null);
    }
  }

  position.addEventListener("change", () => edit({ position_id: position.value }));
  roleHolder.addEventListener("change", () => edit({ first_role_holder: roleHolder.value || null }));
  transitionType.addEventListener("change", () => {
    const previous = selected()?.segment.entered_by;
    const enteredBy: Transition | null = transitionType.value
      ? { transition_type: transitionType.value, ...(previous?.initiator ? { initiator: previous.initiator } : {}) }
      : null;
    edit({ entered_by: enteredBy });
  });
  initiator.addEventListener("change", () => {
    const previous = selected()?.segment.entered_by;
    if (!previous) return;
    edit({
      entered_by: { transition_type: previous.transition_type, ...(initiator.value ? { initiator: initiator.value } : {}) },
    });
  });

  function render() {
    const current = selected();
    body.hidden = !current;
    if (!current) {
      heading.textContent = "Segment";
      return;
    }
    const { session, index, segment } = current;
    heading.textContent = `Segment ${index + 1}: ${formatTime(segment.start)} to ${formatTime(segment.end)}`;

    options(
      position,
      "Pick a Position...",
      vocabulary.positions.map((p) => ({ value: p.id, label: p.name })),
      segment.position_id,
    );
    const athletes = session.annotation.athletes.map((slug) => ({
      value: slug,
      label: registry.athletes[slug]?.name ?? slug,
    }));
    const firstRole = vocabulary.positions.find((p) => p.id === segment.position_id)?.roles?.[0];
    roleLabel.textContent = firstRole ? `${firstRole[0]!.toUpperCase()}${firstRole.slice(1)} ` : "Role holder ";
    options(roleHolder, firstRole ? "Pick..." : "None (symmetric)", athletes, segment.first_role_holder);

    transitionRow.hidden = index === 0;
    options(
      transitionType,
      "None",
      vocabulary.transitions.map((t) => ({ value: t.id, label: t.name })),
      segment.entered_by?.transition_type,
    );
    options(initiator, "None", athletes, segment.entered_by?.initiator);
    initiator.disabled = !segment.entered_by;
  }

  store.subscribe(render);
  selection.subscribe(render);
}
