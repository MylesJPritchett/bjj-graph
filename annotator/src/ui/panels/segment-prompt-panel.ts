// The keyboard prompt shown after a Position hotkey. While it's open it takes
// every key: an option key answers the question, Escape cancels, and once the
// last answer is in the new Segment is started.

import { answerSegmentPrompt, openSegmentPrompt, type SegmentPrompt } from "../../session/segment-prompt";
import type { VideoTime, VocabId } from "../../session/types";
import { h } from "../dom";
import type { Store } from "../store";

export interface SegmentPromptPanel {
  /** Starts the prompt for a Position reached at `time`. */
  open(time: VideoTime, position_id: VocabId): void;
}

export function mountSegmentPrompt(root: HTMLElement, store: Store): SegmentPromptPanel {
  let prompt: SegmentPrompt | undefined;
  root.hidden = true;

  function render() {
    const step = prompt?.step;
    root.hidden = !step;
    if (!prompt || !step) return root.replaceChildren();
    root.replaceChildren(
      h("h3", {}, step.question),
      h(
        "ol",
        { class: "prompt-options" },
        ...step.options.map((o) =>
          h("li", { onclick: () => answer(o.key) }, h("kbd", {}, keyName(o.key)), " ", o.label),
        ),
      ),
      h("p", { class: "prompt-hint" }, h("kbd", {}, "Esc"), " cancel"),
    );
  }

  function answer(key: string) {
    if (!prompt) return;
    prompt = answerSegmentPrompt(prompt, key);
    if (!prompt.step) {
      store.dispatch(prompt.command);
      prompt = undefined;
    }
    render();
  }

  // Capture phase on window, so the prompt sees keys before the global key map.
  window.addEventListener(
    "keydown",
    (event) => {
      if (!prompt || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Shift") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        prompt = undefined;
        render();
      } else {
        answer(event.key);
      }
    },
    { capture: true },
  );

  return {
    open(time, position_id) {
      const { session } = store.state;
      if (!session) return store.notify({ kind: "error", text: "Open or create an Annotation first." });
      const opened = openSegmentPrompt(session, { time, position_id });
      if (!opened.prompt) return store.notify({ kind: "error", text: opened.rejection! });
      prompt = opened.prompt;
      if (!prompt.step) {
        store.dispatch(prompt.command);
        prompt = undefined;
      }
      render();
    },
  };
}

const keyName = (key: string) => (/^[A-Z]$/.test(key) ? `Shift+${key.toLowerCase()}` : key);
