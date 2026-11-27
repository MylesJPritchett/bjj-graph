import { describe, expect, it } from "vitest";
import { newSession, violationsOf } from "../src/session/session";
import { startRelabel, suggestRelabelId } from "../src/session/relabel";
import { run } from "./run";
import { sampleContext } from "./helpers";

const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "official-channel" } as const;

function labelledOriginal() {
  const session = run(newSession(sampleContext(), { id: "original-match", annotator: "first-pass", source }), [
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
    { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
    { type: "start_segment", time: 100, position_id: "standing" },
    { type: "start_segment", time: 150, position_id: "mount" },
  ]);
  return {
    ...session.annotation,
    metadata: { event: "Example Open", round: "final" },
    events: [{ kind: "score" as const, time: 160, athlete: "alex-example", score_type: "points" as const, value: 4 }],
    result: { winner: "alex-example", method: "points" as const },
  };
}

describe("starting a blind re-label", () => {
  it("creates a linked Annotation with the same source and Match bounds and none of the original's labels", () => {
    const outcome = startRelabel(sampleContext(), labelledOriginal(), { id: "original-match-relabel", annotator: "second-pass" });

    expect(outcome.rejection).toBeUndefined();
    expect(outcome.session!.annotation).toEqual({
      id: "original-match-relabel",
      schema_version: 1,
      vocabulary_version: "0.1.0",
      annotator: "second-pass",
      relabel_of: "original-match",
      source,
      match: { start_offset: 100, end_offset: 300 },
      metadata: { event: "Example Open", round: "final" },
      athletes: ["alex-example", "sam-example"],
      segments: [],
      events: [],
    });
  });

  it("is ready to label: the first Segment tiles the original's Match bounds", () => {
    const { session } = startRelabel(sampleContext(), labelledOriginal(), { id: "original-match-relabel", annotator: "second-pass" });

    const labelled = run(session!, [{ type: "start_segment", time: 100, position_id: "standing" }]);

    expect(labelled.annotation.segments).toEqual([{ start: 100, end: 300, position_id: "standing" }]);
    expect(violationsOf(labelled).map((v) => v.rule)).not.toContain("match-bounds-set");
  });

  it("links a re-label of a re-label to the original Annotation", () => {
    const firstRelabel = startRelabel(sampleContext(), labelledOriginal(), { id: "original-match-relabel", annotator: "x" });

    const second = startRelabel(sampleContext(), firstRelabel.session!.annotation, { id: "original-match-relabel-2", annotator: "x" });

    expect(second.session!.annotation.relabel_of).toBe("original-match");
  });

  it("refuses an original without Match bounds, or reusing the original's id", () => {
    const { match: _match, ...unbounded } = labelledOriginal();

    expect(startRelabel(sampleContext(), unbounded, { id: "r", annotator: "x" }).rejection).toMatch(/Match start and end/);
    expect(startRelabel(sampleContext(), labelledOriginal(), { id: "original-match", annotator: "x" }).rejection).toBeDefined();
  });
});

describe("suggesting a re-label id", () => {
  it("appends -relabel, numbering it when that id is taken", () => {
    expect(suggestRelabelId("m1", ["m1"])).toBe("m1-relabel");
    expect(suggestRelabelId("m1", ["m1", "m1-relabel"])).toBe("m1-relabel-2");
    expect(suggestRelabelId("m1", ["m1", "m1-relabel", "m1-relabel-2"])).toBe("m1-relabel-3");
  });
});
