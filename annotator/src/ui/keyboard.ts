// The keyboard map. Each feature contributes a list of bindings; `bindKeys`
// installs them all on the page. Keys are matched on `KeyboardEvent.key`, so an
// uppercase letter means Shift plus that letter (as in the vocabulary hotkeys).
// Reserved by the vocabulary for non-Position use: j k l (playback), y z (redo,
// undo) and p (Score Events).

import type { SessionContext } from "../session/session";
import { changeRate, seekBy, stepFrames, type VideoPlayer } from "./player/player";
import type { Store } from "./store";

export interface KeyBinding {
  key: string;
  /** Shown in the key legend. */
  label: string;
  run: () => void;
}

/** Playhead time as recorded in Annotations: video seconds to 0.01s. */
export const playhead = (player: VideoPlayer) => Math.round(player.currentTime() * 100) / 100;

export function playbackBindings(player: VideoPlayer): KeyBinding[] {
  return [
    { key: "k", label: "play / pause", run: () => player.togglePlay() },
    { key: " ", label: "play / pause", run: () => player.togglePlay() },
    { key: "ArrowLeft", label: "back 1s", run: () => seekBy(player, -1) },
    { key: "ArrowRight", label: "forward 1s", run: () => seekBy(player, 1) },
    { key: "j", label: "back 5s", run: () => seekBy(player, -5) },
    { key: "l", label: "forward 5s", run: () => seekBy(player, 5) },
    { key: ",", label: "back 1 frame", run: () => stepFrames(player, -1) },
    { key: ".", label: "forward 1 frame", run: () => stepFrames(player, 1) },
    { key: "[", label: "slower", run: () => changeRate(player, -1) },
    { key: "]", label: "faster", run: () => changeRate(player, 1) },
  ];
}

/** One binding per Position hotkey: closes the current Segment and opens a new one at the playhead. */
export function positionBindings(context: SessionContext, store: Store, player: VideoPlayer): KeyBinding[] {
  return context.vocabulary.positions.map((position) => ({
    key: position.hotkey,
    label: position.name,
    run: () => store.dispatch({ type: "start_segment", time: playhead(player), position_id: position.id }),
  }));
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function bindKeys(bindings: KeyBinding[]): void {
  const byKey = new Map<string, KeyBinding>();
  for (const binding of bindings) {
    if (byKey.has(binding.key)) throw new Error(`Hotkey "${binding.key}" is bound twice.`);
    byKey.set(binding.key, binding);
  }
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    const binding = byKey.get(event.key);
    if (!binding) return;
    event.preventDefault();
    binding.run();
  });
}
