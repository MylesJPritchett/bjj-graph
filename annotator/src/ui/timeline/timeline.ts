// The timeline strip: the Match's Segments coloured by Family, a playhead,
// and a Family legend. Score Events sit on their own track below the Segments;
// clicking a marker seeks to it and opens it for editing.

import type { Session } from "../../session/session";
import { formatTime, h } from "../dom";
import { describeScoreEvent, type ScoreDialog } from "../panels/score-dialog";
import type { VideoPlayer } from "../player/player";
import type { Store } from "../store";
import { familyColour } from "./family-colours";

export function mountTimeline(root: HTMLElement, store: Store, player: VideoPlayer, scoreDialog: ScoreDialog) {
  const strip = h("div", { class: "timeline-strip" });
  const segmentsLayer = h("div", { class: "timeline-segments" });
  const playheadMarker = h("div", { class: "timeline-playhead" });
  const scoreTrack = h("div", { class: "timeline-score-track", title: "Score Events" });
  const scale = h("div", { class: "timeline-scale" });
  const legend = h("div", { class: "timeline-legend" });
  strip.append(segmentsLayer, playheadMarker);
  root.append(strip, scoreTrack, scale, legend);

  const { vocabulary } = store.state.context;
  for (const family of vocabulary.families) {
    legend.append(
      h("span", { class: "legend-item" }, h("span", { class: "swatch", style: { background: familyColour(family.id) } }), family.name),
    );
  }

  let session: Session | null = null;
  store.subscribe((state) => {
    session = state.session;
    render();
  });

  function render() {
    segmentsLayer.replaceChildren();
    scoreTrack.replaceChildren();
    scale.replaceChildren();
    const match = session?.annotation.match;
    if (!session || !match) {
      segmentsLayer.append(h("div", { class: "timeline-empty" }, "Set the Match start and end to see the timeline."));
      return;
    }
    const span = match.end_offset - match.start_offset;
    scale.append(h("span", {}, formatTime(match.start_offset)), h("span", {}, formatTime(match.end_offset)));
    session.annotation.segments.forEach((segment) => {
      const position = vocabulary.positions.find((p) => p.id === segment.position_id);
      segmentsLayer.append(
        h(
          "div",
          {
            class: "timeline-segment",
            title: `${position?.name ?? segment.position_id}  ${formatTime(segment.start)} to ${formatTime(segment.end)}`,
            style: {
              left: `${((segment.start - match.start_offset) / span) * 100}%`,
              width: `${((segment.end - segment.start) / span) * 100}%`,
              background: familyColour(position?.family),
            },
          },
          h("span", { class: "timeline-segment-label" }, position?.name ?? segment.position_id),
        ),
      );
    });
    renderScoreEvents(session, match.start_offset, span);
  }

  function renderScoreEvents(session: Session, start: number, span: number) {
    const { annotation } = session;
    const { registry } = store.state.context;
    const flagged = new Set(store.state.violations.flatMap((v) => (v.target.kind === "event" ? [v.target.index] : [])));
    annotation.events.forEach((event, index) => {
      const side = annotation.athletes.indexOf(event.athlete);
      const fraction = Math.min(1, Math.max(0, (event.time - start) / span));
      scoreTrack.append(
        h(
          "button",
          {
            type: "button",
            class: `score-marker athlete-${side < 0 ? "unknown" : side}${flagged.has(index) ? " flagged" : ""}`,
            title: describeScoreEvent(event, registry.athletes[event.athlete]?.name ?? event.athlete),
            style: { left: `${fraction * 100}%` },
            onclick: () => {
              player.seek(event.time);
              scoreDialog.edit(index);
            },
          },
          scoreLabel(event.score_type, event.value),
        ),
      );
    });
  }

  const tick = () => {
    const match = session?.annotation.match;
    if (match && player.isLoaded()) {
      const fraction = (player.currentTime() - match.start_offset) / (match.end_offset - match.start_offset);
      playheadMarker.style.display = fraction >= 0 && fraction <= 1 ? "block" : "none";
      playheadMarker.style.left = `${fraction * 100}%`;
    } else {
      playheadMarker.style.display = "none";
    }
    requestAnimationFrame(tick);
  };
  tick();
}

/** A Score Event marker's short label: the value for points, otherwise an initial. */
function scoreLabel(scoreType: string, value?: number): string {
  if (scoreType === "points") return value === undefined ? "P" : String(value);
  const labels: Record<string, string> = { advantage: "A", penalty: "!", submission_finish: "S", submission_attempt: "a" };
  return labels[scoreType] ?? "?";
}
