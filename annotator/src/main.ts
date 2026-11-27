// Boots the annotation tool: loads the shared data, then mounts each component.

import "./style.css";
import { api } from "./ui/api";
import { bindKeys, historyBindings, playbackBindings, positionBindings, transitionLegend } from "./ui/keyboard";
import { mountKeysPanel } from "./ui/panels/keys-panel";
import { mountMatchPanel } from "./ui/panels/match-panel";
import { mountSavePanel } from "./ui/panels/save-panel";
import { mountSegmentEditor } from "./ui/panels/segment-editor";
import { mountSegmentPrompt } from "./ui/panels/segment-prompt-panel";
import { mountSourcePanel } from "./ui/panels/source-panel";
import { mountViolationsPanel } from "./ui/panels/violations-panel";
import { mountPlayer } from "./ui/player/player-view";
import { Store } from "./ui/store";
import { SegmentSelection } from "./ui/timeline/selection";
import { mountTimeline } from "./ui/timeline/timeline";

const slot = (id: string) => document.getElementById(id)!;

async function main() {
  const [vocabulary, registry] = await Promise.all([api.vocabulary(), api.registry()]);
  const context = { vocabulary, registry };
  const store = new Store(context);
  const selection = new SegmentSelection();

  mountSavePanel(slot("save"), store);
  mountSourcePanel(slot("source"), store);
  const player = mountPlayer(slot("player"), store);
  mountMatchPanel(slot("match"), store, player);
  mountTimeline(slot("timeline"), store, player, selection);
  mountSegmentEditor(slot("segment-editor"), store, selection);
  mountViolationsPanel(slot("violations"), store, selection);

  const segmentPrompt = mountSegmentPrompt(slot("segment-prompt"), store);

  const playback = playbackBindings(player);
  const history = historyBindings(store);
  const positions = positionBindings(context, segmentPrompt, player);
  bindKeys([...playback, ...history, ...positions]);
  mountKeysPanel(slot("keys"), [
    { title: "Playback", bindings: playback },
    { title: "Edit", bindings: history },
    { title: "Positions", bindings: positions },
    // Not bound globally: these keys only answer the prompt that follows a Position hotkey.
    { title: "Transitions (in the prompt)", bindings: transitionLegend(context) },
  ]);
}

main().catch((error) => {
  document.body.prepend(`Couldn't start the annotator: ${(error as Error).message}`);
});
