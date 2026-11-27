// Boots the annotation tool: loads the shared data, then mounts each component.

import "./style.css";
import { api } from "./ui/api";
import { bindKeys, playbackBindings, positionBindings } from "./ui/keyboard";
import { mountKeysPanel } from "./ui/panels/keys-panel";
import { mountMatchPanel } from "./ui/panels/match-panel";
import { mountSavePanel } from "./ui/panels/save-panel";
import { mountSourcePanel } from "./ui/panels/source-panel";
import { mountViolationsPanel } from "./ui/panels/violations-panel";
import { mountPlayer } from "./ui/player/player-view";
import { Store } from "./ui/store";
import { mountTimeline } from "./ui/timeline/timeline";

const slot = (id: string) => document.getElementById(id)!;

async function main() {
  const [vocabulary, registry] = await Promise.all([api.vocabulary(), api.registry()]);
  const context = { vocabulary, registry };
  const store = new Store(context);

  mountSavePanel(slot("save"), store);
  mountSourcePanel(slot("source"), store);
  const player = mountPlayer(slot("player"), store);
  mountMatchPanel(slot("match"), store, player);
  mountTimeline(slot("timeline"), store, player);
  mountViolationsPanel(slot("violations"), store);

  const playback = playbackBindings(player);
  const positions = positionBindings(context, store, player);
  bindKeys([...playback, ...positions]);
  mountKeysPanel(slot("keys"), [
    { title: "Playback", bindings: playback },
    { title: "Positions", bindings: positions },
  ]);
}

main().catch((error) => {
  document.body.prepend(`Couldn't start the annotator: ${(error as Error).message}`);
});
