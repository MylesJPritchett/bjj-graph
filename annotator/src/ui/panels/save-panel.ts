// Save the Annotation to annotations/<id>.json, plus the notice line.

import { api, ApiError } from "../api";
import { h } from "../dom";
import type { Store } from "../store";

export function mountSavePanel(root: HTMLElement, store: Store) {
  const title = h("span", { class: "annotation-title" });
  const save = h("button", { onclick: () => void saveNow() }, "Save");
  const notice = h("span", { class: "notice" });
  root.append(title, save, notice);

  async function saveNow() {
    const session = store.state.session;
    if (!session) return;
    try {
      await api.saveAnnotation(session.annotation);
      store.markSaved();
      const open = store.state.violations.length;
      store.notify({
        kind: "info",
        text: `Saved annotations/${session.annotation.id}.json${open ? ` with ${open} violation(s) still open` : ""}.`,
      });
    } catch (error) {
      const details = error instanceof ApiError && error.details.length ? ` (${error.details.join("; ")})` : "";
      store.notify({ kind: "error", text: `Save failed: ${(error as Error).message}${details}` });
    }
  }

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      void saveNow();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (store.state.dirty) event.preventDefault();
  });

  store.subscribe((state) => {
    const annotation = state.session?.annotation;
    title.textContent = annotation
      ? `${annotation.id}${annotation.relabel_of ? ` (re-label of ${annotation.relabel_of})` : ""}${state.dirty ? " *" : ""}`
      : "No Annotation open";
    save.disabled = !state.session;
    notice.textContent = state.notice?.text ?? "";
    notice.className = `notice ${state.notice?.kind ?? ""}`;
  });
}
