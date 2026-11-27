// The player area: the embed plus a status line.

import { formatTime, h } from "../dom";
import type { Store } from "../store";
import type { VideoPlayer } from "./player";
import { YouTubePlayer } from "./youtube-player";

export function mountPlayer(root: HTMLElement, store: Store): VideoPlayer {
  const host = h("div");
  const status = h("div", { class: "player-status" });
  root.append(h("div", { class: "player-frame" }, host), status);

  const player = new YouTubePlayer(host);

  // Clicking the embed moves keyboard focus into its iframe, where the page
  // can't hear hotkeys. Hand focus straight back to the page.
  window.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) document.activeElement.blur();
    }, 0);
  });

  let loadedId: string | undefined;
  store.subscribe(({ session }) => {
    const videoId = session?.annotation.source.video_id;
    if (videoId && videoId !== loadedId) {
      loadedId = videoId;
      void player.load(videoId);
    }
  });

  const tick = () => {
    status.textContent = player.isLoaded()
      ? `${formatTime(player.currentTime())}  ·  ${player.rate()}x  ·  ${player.isPlaying() ? "playing" : "paused"}`
      : "No video loaded";
    requestAnimationFrame(tick);
  };
  tick();

  return player;
}
