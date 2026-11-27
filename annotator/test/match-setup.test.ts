import { describe, expect, it } from "vitest";
import { apply, newSession } from "../src/session/session";
import { run } from "./run";
import { sampleContext } from "./helpers";

const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" } as const;
const fresh = () => newSession(sampleContext(), { id: "test-match", annotator: "tester", source });

describe("creating an Annotation from a source", () => {
  it("starts empty, stamped with the schema and vocabulary versions", () => {
    expect(fresh().annotation).toEqual({
      id: "test-match",
      schema_version: 1,
      vocabulary_version: "0.1.0",
      annotator: "tester",
      source,
      metadata: {},
      athletes: [],
      segments: [],
      events: [],
    });
  });
});

describe("Match bounds", () => {
  it("records the Match only once both offsets are set", () => {
    const started = run(fresh(), [{ type: "set_match_start", time: 42 }]);
    expect(started.annotation.match).toBeUndefined();

    const bounded = run(started, [{ type: "set_match_end", time: 400 }]);
    expect(bounded.annotation.match).toEqual({ start_offset: 42, end_offset: 400 });
  });

  it("rejects an end before the start", () => {
    const started = run(fresh(), [{ type: "set_match_start", time: 42 }]);
    expect(apply(started, { type: "set_match_end", time: 42 }).rejection).toBeDefined();
    expect(apply(started, { type: "set_match_end", time: 10 }).rejection).toBeDefined();
  });

  it("moving the offsets stretches the first and last Segments so they still tile the Match", () => {
    const session = run(fresh(), [
      { type: "set_match_start", time: 100 },
      { type: "set_match_end", time: 300 },
      { type: "start_segment", time: 100, position_id: "standing" },
      { type: "start_segment", time: 150, position_id: "mount" },
      { type: "set_match_start", time: 90 },
      { type: "set_match_end", time: 320 },
    ]);

    expect(session.annotation.match).toEqual({ start_offset: 90, end_offset: 320 });
    expect(session.annotation.segments).toEqual([
      { start: 90, end: 150, position_id: "standing" },
      { start: 150, end: 320, position_id: "mount" },
    ]);
  });

  it("rejects moving an offset past the inner edge of the first or last Segment", () => {
    const session = run(fresh(), [
      { type: "set_match_start", time: 100 },
      { type: "set_match_end", time: 300 },
      { type: "start_segment", time: 100, position_id: "standing" },
      { type: "start_segment", time: 150, position_id: "mount" },
    ]);

    expect(apply(session, { type: "set_match_start", time: 150 }).rejection).toBeDefined();
    expect(apply(session, { type: "set_match_end", time: 150 }).rejection).toBeDefined();
  });
});

describe("picking Athletes", () => {
  it("records the two Athletes from the registry", () => {
    const session = run(fresh(), [{ type: "set_athletes", athletes: ["alex-example", "sam-example"] }]);
    expect(session.annotation.athletes).toEqual(["alex-example", "sam-example"]);
  });

  it("rejects an Athlete missing from the registry, a repeated Athlete, or a third Athlete", () => {
    expect(apply(fresh(), { type: "set_athletes", athletes: ["nobody"] }).rejection).toMatch(/nobody/);
    expect(apply(fresh(), { type: "set_athletes", athletes: ["sam-example", "sam-example"] }).rejection).toBeDefined();
    expect(
      apply(fresh(), { type: "set_athletes", athletes: ["sam-example", "alex-example", "sam-example"] }).rejection,
    ).toBeDefined();
  });
});
