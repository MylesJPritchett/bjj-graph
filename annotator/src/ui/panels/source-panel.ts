// Start a new Annotation from a pasted video URL, reopen a saved one, or
// start a blind re-label of a saved one.

import { startRelabel, suggestRelabelId } from "../../session/relabel";
import { newSession, openSession } from "../../session/session";
import { sourceFromUrl, suggestAnnotationId } from "../../session/source";
import { api } from "../api";
import { h } from "../dom";
import type { Store } from "../store";

const ANNOTATOR_KEY = "bjj-graph.annotator";

function rememberedAnnotator(): string {
  try {
    return localStorage.getItem(ANNOTATOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberAnnotator(name: string) {
  try {
    localStorage.setItem(ANNOTATOR_KEY, name);
  } catch {
    // Storage unavailable; the name just isn't remembered.
  }
}

export function mountSourcePanel(root: HTMLElement, store: Store) {
  const url = h("input", { type: "url", placeholder: "https://www.youtube.com/watch?v=...", size: 40 });
  const id = h("input", { type: "text", placeholder: "annotation-id", size: 28 });
  const annotator = h("input", { type: "text", placeholder: "your name", value: rememberedAnnotator(), size: 14 });
  const existing = h("select", {}, h("option", { value: "" }, "Saved Annotations..."));

  let idEdited = false;
  id.addEventListener("input", () => (idEdited = true));
  url.addEventListener("input", () => {
    const source = sourceFromUrl(url.value);
    if (source?.video_id && !idEdited) id.value = suggestAnnotationId(source.video_id);
  });

  async function refreshList() {
    const ids = await api.listAnnotations();
    existing.replaceChildren(h("option", { value: "" }, "Saved Annotations..."), ...ids.map((i) => h("option", { value: i }, i)));
    return ids;
  }

  const confirmDiscard = () => !store.state.dirty || confirm("Discard unsaved changes?");

  async function create() {
    const source = sourceFromUrl(url.value);
    if (!source) return store.notify({ kind: "error", text: "Paste a YouTube video URL." });
    if (!annotator.value.trim()) return store.notify({ kind: "error", text: "Enter who is annotating." });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id.value)) {
      return store.notify({ kind: "error", text: "The Annotation id must be lowercase kebab-case." });
    }
    if ((await refreshList()).includes(id.value)) {
      return store.notify({ kind: "error", text: `"${id.value}" already exists. Open it instead, or pick another id.` });
    }
    if (!confirmDiscard()) return;
    rememberAnnotator(annotator.value.trim());
    store.open(newSession(store.state.context, { id: id.value, annotator: annotator.value.trim(), source }), true);
    idEdited = false;
  }

  async function open() {
    if (!existing.value || !confirmDiscard()) return;
    try {
      const annotation = await api.readAnnotation(existing.value);
      store.open(openSession(store.state.context, annotation));
    } catch (error) {
      store.notify({ kind: "error", text: `Couldn't open: ${(error as Error).message}` });
    }
  }

  /**
   * Re-labels the picked Annotation blind. The original is read only for its
   * source, Match bounds, metadata and Athletes; its labels are never shown.
   */
  async function relabel() {
    if (!existing.value) return store.notify({ kind: "error", text: "Pick the saved Annotation to re-label." });
    if (!annotator.value.trim()) return store.notify({ kind: "error", text: "Enter who is annotating." });
    if (!confirmDiscard()) return;
    try {
      const [original, ids] = await Promise.all([api.readAnnotation(existing.value), refreshList()]);
      const outcome = startRelabel(store.state.context, original, {
        id: suggestRelabelId(original.id, ids),
        annotator: annotator.value.trim(),
      });
      if (!outcome.session) return store.notify({ kind: "error", text: outcome.rejection ?? "Couldn't start the re-label." });
      rememberAnnotator(annotator.value.trim());
      store.open(outcome.session, true);
      store.notify({ kind: "info", text: `Re-labelling ${original.id} blind. Seek to the Match start and label from there.` });
    } catch (error) {
      store.notify({ kind: "error", text: `Couldn't start the re-label: ${(error as Error).message}` });
    }
  }

  root.append(
    h(
      "div",
      { class: "row" },
      h("label", {}, "Video URL ", url),
      h("label", {}, "Id ", id),
      h("label", {}, "Annotator ", annotator),
      h("button", { onclick: create }, "New Annotation"),
    ),
    h(
      "div",
      { class: "row" },
      existing,
      h("button", { onclick: open }, "Open"),
      h("button", { onclick: relabel, title: "A new, linked Annotation of the same Match, without the original's labels" }, "Start re-label"),
    ),
  );
  // Refresh the saved list on load and after each save.
  let wasDirty = true;
  store.subscribe(({ dirty }) => {
    if (wasDirty && !dirty) void refreshList();
    wasDirty = dirty;
  });
}
