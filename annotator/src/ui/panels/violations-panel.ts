// The list of validation violations for the current Annotation. Clicking a
// Segment's violation selects that Segment: it's outlined on the timeline and
// opened in the Segment editor.

import type { ViolationTarget } from "../../session/validation";
import { h } from "../dom";
import type { Store } from "../store";
import type { SegmentSelection } from "../timeline/selection";

function describeTarget(target: ViolationTarget): string {
  switch (target.kind) {
    case "segment":
      return `Segment ${target.index + 1}`;
    case "event":
      return `Event ${target.index + 1}`;
    default:
      return target.kind[0]!.toUpperCase() + target.kind.slice(1);
  }
}

export function mountViolationsPanel(root: HTMLElement, store: Store, selection: SegmentSelection) {
  const heading = h("h3");
  const list = h("ul", { class: "violations" });
  root.append(heading, list);

  function render() {
    const { session, violations } = store.state;
    const selected = selection.get();
    heading.textContent = session ? `Violations (${violations.length})` : "Violations";
    list.replaceChildren(
      ...violations.map((v) => {
        const target = v.target;
        const segment = target.kind === "segment" ? target.index : undefined;
        return h(
          "li",
          {
            "data-rule": v.rule,
            class: segment === undefined ? undefined : segment === selected ? "segment-violation selected" : "segment-violation",
            title: segment === undefined ? undefined : "Show this Segment",
            onclick: segment === undefined ? undefined : () => selection.set(segment),
          },
          h("strong", {}, describeTarget(target)),
          ": ",
          v.message,
        );
      }),
    );
  }

  store.subscribe(render);
  selection.subscribe(render);
}
