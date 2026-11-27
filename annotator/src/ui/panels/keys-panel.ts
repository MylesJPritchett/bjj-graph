// A legend of every key binding.

import { h } from "../dom";
import type { KeyBinding } from "../keyboard";

const keyName = (key: string) => (key === " " ? "Space" : /^[A-Z]$/.test(key) ? `Shift+${key.toLowerCase()}` : key);

export function mountKeysPanel(root: HTMLElement, groups: { title: string; bindings: KeyBinding[] }[]) {
  for (const group of groups) {
    root.append(
      h("h3", {}, group.title),
      h(
        "dl",
        { class: "keys" },
        ...group.bindings.flatMap((b) => [h("dt", {}, h("kbd", {}, keyName(b.key))), h("dd", {}, b.label)]),
      ),
    );
  }
}
