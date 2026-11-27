// The list of validation violations for the current Annotation.

import type { ViolationTarget } from "../../session/validation";
import { h } from "../dom";
import type { Store } from "../store";

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

export function mountViolationsPanel(root: HTMLElement, store: Store) {
  const heading = h("h3");
  const list = h("ul", { class: "violations" });
  root.append(heading, list);

  store.subscribe(({ session, violations, highlighted }) => {
    heading.textContent = session ? `Violations (${violations.length})` : "Violations";
    list.replaceChildren(
      ...violations.map((v) =>
        h(
          "li",
          {
            "data-rule": v.rule,
            class: sameTarget(v.target, highlighted) ? "highlighted" : undefined,
            title: "Highlight on the timeline",
            onclick: () => store.highlight(sameTarget(v.target, store.state.highlighted) ? undefined : v.target),
          },
          h("strong", {}, describeTarget(v.target)),
          ": ",
          v.message,
        ),
      ),
    );
  });
}

function sameTarget(a: ViolationTarget, b: ViolationTarget | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
