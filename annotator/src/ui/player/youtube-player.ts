// VideoPlayer backed by the YouTube IFrame Player API.

import type { VideoPlayer } from "./player";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | undefined;

function loadIframeApi(): Promise<void> {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return apiReady;
}

export class YouTubePlayer implements VideoPlayer {
  private player: YT.Player | undefined;
  private videoId: string | undefined;

  /** `host` is replaced by the iframe. */
  constructor(private readonly host: HTMLElement) {}

  async load(videoId: string): Promise<void> {
    await loadIframeApi();
    if (this.player) {
      if (this.videoId !== videoId) this.player.cueVideoById(videoId);
      this.videoId = videoId;
      return;
    }
    this.videoId = videoId;
    await new Promise<void>((resolve) => {
      this.player = new YT.Player(this.host, {
        videoId,
        width: "100%",
        height: "100%",
        // disablekb: the tool's own keyboard map drives playback.
        playerVars: { disablekb: 1, rel: 0, playsinline: 1 },
        events: { onReady: () => resolve() },
      });
    });
  }

  isLoaded() {
    return this.player !== undefined;
  }

  currentTime() {
    return this.player?.getCurrentTime() ?? 0;
  }

  seek(seconds: number) {
    this.player?.seekTo(seconds, true);
  }

  isPlaying() {
    return this.player?.getPlayerState() === YT.PlayerState.PLAYING;
  }

  togglePlay() {
    if (!this.player) return;
    if (this.isPlaying()) this.player.pauseVideo();
    else this.player.playVideo();
  }

  pause() {
    this.player?.pauseVideo();
  }

  rate() {
    return this.player?.getPlaybackRate() ?? 1;
  }

  setRate(rate: number) {
    this.player?.setPlaybackRate(rate);
  }

  availableRates() {
    return this.player?.getAvailablePlaybackRates() ?? [1];
  }
}
