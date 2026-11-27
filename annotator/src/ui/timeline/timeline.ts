// The timeline strip: the Match's Segments coloured by Family, a playhead,
// and a Family legend. Read-only for now.

import type { Session } from "../../session/session";
import { formatTime, h } from "../dom";
import type { VideoPlayer } from "../player/player";
import type { Store } from "../store";
import { familyColour } from "./family-colours";

export function mountTimeline(root: HTMLElement, store: Store, player: VideoPlayer) {
  const strip = h("div", { class: "timeline-strip" });
  const segmentsLayer = h("div", { class: "timeline-segments" });
  const playheadMarker = h("div", { class: "timeline-playhead" });
  const scale = h("div", { class: "timeline-scale" });
  const legend = h("div", { class: "timeline-legend" });
  strip.append(segmentsLayer, playheadMarker);
  root.append(strip, scale, legend);

  const { vocabulary } = store.state.context;
  for (const family of vocabulary.families) {
    legend.append(
      h("span", { class: "legend-item" }, h("span", { class: "swatch", style: { background: familyColour(family.id) } }), family.name),
    );
  }

  let session: Session | null = null;
  let highlightedSegment: number | undefined;
  store.subscribe((state) => {
    session = state.session;
    highlightedSegment = state.highlighted?.kind === "segment" ? state.highlighted.index : undefined;
    render();
  });

  function render() {
    segmentsLayer.replaceChildren();
    scale.replaceChildren();
    const match = session?.annotation.match;
    if (!session || !match) {
      segmentsLayer.append(h("div", { class: "timeline-empty" }, "Set the Match start and end to see the timeline."));
      return;
    }
    const span = match.end_offset - match.start_offset;
    scale.append(h("span", {}, formatTime(match.start_offset)), h("span", {}, formatTime(match.end_offset)));
    session.annotation.segments.forEach((segment, index) => {
      const position = vocabulary.positions.find((p) => p.id === segment.position_id);
      segmentsLayer.append(
        h(
          "div",
          {
            class: index === highlightedSegment ? "timeline-segment highlighted" : "timeline-segment",
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
