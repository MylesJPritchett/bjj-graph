// The timeline strip: the Match's Segments coloured by Family, a playhead,
// and a Family legend. Click a Segment to seek to it and open it in the
// Segment editor; drag the handle between two Segments to retime a Transition.

import type { Session } from "../../session/session";
import { formatTime, h } from "../dom";
import type { VideoPlayer } from "../player/player";
import type { Store } from "../store";
import { familyColour } from "./family-colours";
import type { SegmentSelection } from "./selection";

/** Boundary times are recorded to 0.01s, like the playhead. */
const toHundredths = (t: number) => Math.round(t * 100) / 100;

export function mountTimeline(root: HTMLElement, store: Store, player: VideoPlayer, selection: SegmentSelection) {
  const strip = h("div", { class: "timeline-strip" });
  const segmentsLayer = h("div", { class: "timeline-segments" });
  const boundariesLayer = h("div", { class: "timeline-boundaries" });
  const playheadMarker = h("div", { class: "timeline-playhead" });
  const scale = h("div", { class: "timeline-scale" });
  const legend = h("div", { class: "timeline-legend" });
  strip.append(segmentsLayer, boundariesLayer, playheadMarker);
  root.append(strip, scale, legend);

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
  selection.subscribe(() => render());

  /** Video time at a horizontal pointer position over the strip. */
  function timeAt(clientX: number): number {
    const match = session!.annotation.match!;
    const rect = strip.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return toHundredths(match.start_offset + fraction * (match.end_offset - match.start_offset));
  }

  function render() {
    segmentsLayer.replaceChildren();
    boundariesLayer.replaceChildren();
    scale.replaceChildren();
    const match = session?.annotation.match;
    if (!session || !match) {
      segmentsLayer.append(h("div", { class: "timeline-empty" }, "Set the Match start and end to see the timeline."));
      return;
    }
    const span = match.end_offset - match.start_offset;
    const percent = (t: number) => `${((t - match.start_offset) / span) * 100}%`;
    scale.append(h("span", {}, formatTime(match.start_offset)), h("span", {}, formatTime(match.end_offset)));
    const selected = selection.get();

    session.annotation.segments.forEach((segment, index) => {
      const position = vocabulary.positions.find((p) => p.id === segment.position_id);
      segmentsLayer.append(
        h(
          "div",
          {
            class: index === selected ? "timeline-segment selected" : "timeline-segment",
            title: `${position?.name ?? segment.position_id}  ${formatTime(segment.start)} to ${formatTime(segment.end)}`,
            style: {
              left: percent(segment.start),
              width: `${((segment.end - segment.start) / span) * 100}%`,
              background: familyColour(position?.family),
            },
            onclick: () => {
              player.seek(segment.start);
              selection.set(index);
            },
          },
          h("span", { class: "timeline-segment-label" }, position?.name ?? segment.position_id),
        ),
      );
      if (index > 0) boundariesLayer.append(boundaryHandle(index, segment.start, percent));
    });
  }

  /** A draggable handle on the boundary where Segment `index` starts. */
  function boundaryHandle(index: number, time: number, percent: (t: number) => string): HTMLElement {
    const handle = h("div", { class: "timeline-boundary", title: `Drag to retime (${formatTime(time)})`, style: { left: percent(time) } });
    handle.addEventListener("pointerdown", (down) => {
      down.preventDefault();
      down.stopPropagation();
      handle.setPointerCapture(down.pointerId);
      handle.classList.add("dragging");
      let dragged = time;
      const move = (event: PointerEvent) => {
        dragged = timeAt(event.clientX);
        handle.style.left = percent(dragged);
        handle.title = formatTime(dragged);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        if (dragged === time || !store.dispatch({ type: "move_boundary", segment: index, time: dragged })) render();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    return handle;
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
