// The Result form: winner (or draw) and its Method.

import { METHODS, type Method } from "../../session/types";
import { h } from "../dom";
import type { Store } from "../store";

const METHOD_LABELS: Record<Method, string> = {
  submission: "Submission",
  points: "Points",
  advantages: "Advantages",
  referee_decision: "Referee decision",
  disqualification: "Disqualification",
  draw: "Draw",
};

export function mountResultPanel(root: HTMLElement, store: Store) {
  const winner = h("select");
  const method = h("select");
  method.append(h("option", { value: "" }, "Method..."), ...METHODS.map((m) => h("option", { value: m }, METHOD_LABELS[m])));
  const clear = h("button", { type: "button" }, "Clear");
  const hint = h("span", { class: "hint" });

  // A draw has no winner and every other Method has one, so only send complete pairs.
  function commit() {
    const m = method.value as Method | "";
    if (m === "draw") winner.value = "";
    if (!m) return void (hint.textContent = "Pick a Method.");
    if (m !== "draw" && !winner.value) return void (hint.textContent = "Pick the winner.");
    hint.textContent = "";
    const result = m === "draw" ? { method: m } : { winner: winner.value, method: m };
    if (!store.dispatch({ type: "set_result", result })) render();
  }
  winner.addEventListener("change", commit);
  method.addEventListener("change", commit);
  clear.addEventListener("click", () => {
    hint.textContent = "";
    if (store.state.session?.annotation.result) store.dispatch({ type: "clear_result" });
  });

  root.append(h("h3", {}, "Result"), h("div", { class: "row" }, h("label", {}, "Winner ", winner), h("label", {}, "Method ", method), clear, hint));

  function render() {
    const annotation = store.state.session?.annotation;
    const { registry } = store.state.context;
    winner.replaceChildren(
      h("option", { value: "" }, "None (draw)"),
      ...(annotation?.athletes ?? []).map((slug) => h("option", { value: slug }, registry.athletes[slug]?.name ?? slug)),
    );
    winner.value = annotation?.result?.winner ?? "";
    method.value = annotation?.result?.method ?? "";
    for (const field of [winner, method, clear]) field.disabled = !annotation;
  }
  store.subscribe(render);
}
