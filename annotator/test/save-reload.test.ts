import { describe, expect, it } from "vitest";
import { schemaErrors } from "../server/schema";
import { fromJson, toJson } from "../src/session/serialize";
import { newSession, openSession, violationsOf } from "../src/session/session";
import { readVocabText, sampleContext } from "./helpers";
import { run } from "./run";

function labelledMatch() {
  return run(
    newSession(sampleContext(), {
      id: "example-open-2026-final",
      annotator: "tester",
      source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "official-channel" },
    }),
    [
      { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
      { type: "set_match_start", time: 12.5 },
      { type: "set_match_end", time: 312 },
      { type: "start_segment", time: 12.5, position_id: "standing" },
      { type: "start_segment", time: 40, position_id: "open_guard" },
      { type: "start_segment", time: 95.25, position_id: "side_control" },
    ],
  );
}

describe("save and reload", () => {
  it("a labelled Match saves to a file that validates against the Annotation JSON Schema", () => {
    const saved = toJson(labelledMatch().annotation);

    expect(schemaErrors(JSON.parse(saved))).toEqual([]);
  });

  it("work in progress (no bounds, no Athletes, no Segments) is still schema-valid", () => {
    const session = newSession(sampleContext(), {
      id: "wip",
      annotator: "tester",
      source: { platform: "youtube", url: "https://www.youtube.com/watch?v=EXAMPLEVID0", licence_status: "unknown" },
    });

    expect(schemaErrors(JSON.parse(toJson(session.annotation)))).toEqual([]);
  });

  it("save -> reload -> save leaves the document and its violations unchanged", () => {
    const original = labelledMatch();
    const saved = toJson(original.annotation);

    const reopened = openSession(sampleContext(), fromJson(saved));

    expect(reopened.annotation).toEqual(original.annotation);
    expect(toJson(reopened.annotation)).toBe(saved);
    expect(violationsOf(reopened)).toEqual(violationsOf(original));
  });

  it("a reopened Annotation keeps labelling from where it left off", () => {
    const reopened = openSession(sampleContext(), fromJson(toJson(labelledMatch().annotation)));

    const continued = run(reopened, [{ type: "start_segment", time: 200, position_id: "mount" }]);

    expect(continued.annotation.segments.slice(-2)).toEqual([
      { start: 95.25, end: 200, position_id: "side_control" },
      { start: 200, end: 312, position_id: "mount" },
    ]);
  });

  it("the hand-written sample Annotation round-trips unchanged", () => {
    const text = readVocabText("examples/sample-annotation.json");
    const reopened = openSession(sampleContext(), fromJson(text));

    expect(JSON.parse(toJson(reopened.annotation))).toEqual(JSON.parse(text));
    expect(schemaErrors(reopened.annotation)).toEqual([]);
  });

  it("the schema check reports a malformed document", () => {
    expect(schemaErrors({ id: "Not A Slug" })).not.toEqual([]);
  });
});
