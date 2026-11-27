import { describe, expect, it } from "vitest";
import { newSession, openSession, violationsOf } from "../src/session/session";
import type { Annotation } from "../src/session/types";
import { readVocabJson, sampleContext } from "./helpers";
import { run } from "./run";

const sample = () => readVocabJson<Annotation>("examples/sample-annotation.json");
const tilingViolations = (annotation: Annotation) =>
  violationsOf(openSession(sampleContext(), annotation)).filter((v) => v.rule === "segments-tile-match");

describe("Segments tile the Match", () => {
  it("the sample Annotation has no tiling violations", () => {
    expect(tilingViolations(sample())).toEqual([]);
  });

  it("a timeline built from commands never has tiling violations", () => {
    const session = run(
      newSession(sampleContext(), {
        id: "built",
        annotator: "tester",
        source: { platform: "youtube", video_id: "x", licence_status: "unknown" },
      }),
      [
        { type: "set_match_start", time: 10 },
        { type: "set_match_end", time: 200 },
        { type: "start_segment", time: 10, position_id: "standing" },
        { type: "start_segment", time: 90, position_id: "turtle" },
        { type: "start_segment", time: 40, position_id: "scramble" },
        { type: "set_match_end", time: 250 },
      ],
    );
    expect(tilingViolations(session.annotation)).toEqual([]);
  });

  it("flags a gap, naming the Segment after it", () => {
    const annotation = sample();
    annotation.segments[2]!.start = 145; // previous ends at 140

    expect(tilingViolations(annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 2 }, message: expect.stringMatching(/gap/i) }),
    ]);
  });

  it("flags an overlap, naming the Segment after it", () => {
    const annotation = sample();
    annotation.segments[3]!.start = 160; // previous ends at 165

    expect(tilingViolations(annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 3 }, message: expect.stringMatching(/overlap/i) }),
    ]);
  });

  it("flags a first Segment that doesn't start at the Match start and a last one that doesn't reach the end", () => {
    const annotation = sample();
    annotation.segments[0]!.start = 105;
    annotation.segments[8]!.end = 300;

    expect(tilingViolations(annotation).map((v) => v.target)).toEqual([
      { kind: "segment", index: 0 },
      { kind: "segment", index: 8 },
    ]);
  });

  it("flags a Segment that ends before it starts", () => {
    const annotation = sample();
    annotation.segments[4] = { ...annotation.segments[4]!, start: 212, end: 200 };

    expect(tilingViolations(annotation)).toContainEqual(
      expect.objectContaining({ target: { kind: "segment", index: 4 } }),
    );
  });

  it("flags Segments when the Match bounds are missing", () => {
    const { match: _match, ...annotation } = sample();

    expect(tilingViolations(annotation)).toEqual([expect.objectContaining({ target: { kind: "match" } })]);
  });
});

describe("ids exist in the vocabulary and the registry", () => {
  it("flags an unknown Position on the Segment that uses it", () => {
    const annotation = sample();
    annotation.segments[1]!.position_id = "flying_squirrel";

    expect(violationsOf(openSession(sampleContext(), annotation))).toContainEqual(
      expect.objectContaining({ rule: "known-position", target: { kind: "segment", index: 1 } }),
    );
  });

  it("flags an Athlete missing from the registry", () => {
    const annotation = sample();
    annotation.athletes = ["alex-example", "ghost-example"];

    expect(violationsOf(openSession(sampleContext(), annotation))).toContainEqual(
      expect.objectContaining({ rule: "known-athletes", target: { kind: "athletes" } }),
    );
  });

  it("flags fewer than two Athletes", () => {
    const annotation = sample();
    annotation.athletes = ["alex-example"];

    expect(violationsOf(openSession(sampleContext(), annotation))).toContainEqual(
      expect.objectContaining({ rule: "two-athletes", target: { kind: "athletes" } }),
    );
  });
});
