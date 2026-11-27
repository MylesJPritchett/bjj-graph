// The video player interface the rest of the UI uses. Video is only ever
// played through the platform's embed player (ADR-0002).

export interface VideoPlayer {
  load(videoId: string): Promise<void>;
  isLoaded(): boolean;
  /** The playhead, in video seconds. */
  currentTime(): number;
  seek(seconds: number): void;
  togglePlay(): void;
  pause(): void;
  isPlaying(): boolean;
  rate(): number;
  setRate(rate: number): void;
  availableRates(): number[];
}

/** Assumed frame length for frame-stepping; embeds don't expose the real frame rate. */
export const FRAME_SECONDS = 1 / 30;

export function stepFrames(player: VideoPlayer, frames: number) {
  player.pause();
  player.seek(Math.max(0, player.currentTime() + frames * FRAME_SECONDS));
}

export function seekBy(player: VideoPlayer, seconds: number) {
  player.seek(Math.max(0, player.currentTime() + seconds));
}

export function changeRate(player: VideoPlayer, steps: number) {
  const rates = player.availableRates();
  const index = rates.indexOf(player.rate());
  const next = rates[Math.min(rates.length - 1, Math.max(0, (index < 0 ? rates.indexOf(1) : index) + steps))];
  if (next !== undefined) player.setRate(next);
}
