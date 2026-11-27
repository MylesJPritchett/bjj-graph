// Match bounds from the playhead, and the two Athletes from the registry.

import { formatTime, h } from "../dom";
import { playhead } from "../keyboard";
import type { VideoPlayer } from "../player/player";
import type { Store } from "../store";

export function mountMatchPanel(root: HTMLElement, store: Store, player: VideoPlayer) {
  const startLabel = h("span", { class: "mono" });
  const endLabel = h("span", { class: "mono" });
  const athleteA = h("select");
  const athleteB = h("select");

  const { registry } = store.state.context;
  const slugs = Object.keys(registry.athletes).sort();
  for (const select of [athleteA, athleteB]) {
    select.append(
      h("option", { value: "" }, slugs.length ? "Pick an Athlete..." : "Registry is empty"),
      ...slugs.map((slug) => h("option", { value: slug }, `${registry.athletes[slug]!.name} (${slug})`)),
    );
    select.addEventListener("change", () => {
      const picked = [athleteA.value, athleteB.value].filter(Boolean);
      if (!store.dispatch({ type: "set_athletes", athletes: picked })) render();
    });
  }

  const seekTo = (t: number | undefined) => t !== undefined && player.seek(t);

  root.append(
    h(
      "div",
      { class: "row" },
      h("span", {}, "Match start ", startLabel),
      h("button", { onclick: () => store.dispatch({ type: "set_match_start", time: playhead(player) }) }, "Set from playhead"),
      h("button", { onclick: () => seekTo(store.state.session?.bounds.start) }, "Go"),
      h("span", {}, "Match end ", endLabel),
      h("button", { onclick: () => store.dispatch({ type: "set_match_end", time: playhead(player) }) }, "Set from playhead"),
      h("button", { onclick: () => seekTo(store.state.session?.bounds.end) }, "Go"),
    ),
    h("div", { class: "row" }, h("label", {}, "Athlete A ", athleteA), h("label", {}, "Athlete B ", athleteB)),
  );

  function render() {
    const session = store.state.session;
    const bounds = session?.bounds ?? {};
    startLabel.textContent = bounds.start === undefined ? "not set" : formatTime(bounds.start);
    endLabel.textContent = bounds.end === undefined ? "not set" : formatTime(bounds.end);
    const athletes = session?.annotation.athletes ?? [];
    athleteA.value = athletes[0] ?? "";
    athleteB.value = athletes[1] ?? "";
  }
  store.subscribe(render);
}
