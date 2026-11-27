import { describe, expect, it } from "vitest";
import { apply, newSession, type Session } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

function freshMatch(): Session {
  const session = newSession(sampleContext(), {
    id: "test-match",
    annotator: "tester",
    source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
  });
  return run(session, [
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
  ]);
}

describe("starting Segments", () => {
  it("the first Position hotkey opens a Segment covering the whole Match", () => {
    const session = run(freshMatch(), [{ type: "start_segment", time: 104, position_id: "standing" }]);

    expect(session.annotation.segments).toEqual([{ start: 100, end: 300, position_id: "standing" }]);
  });

  it("a later Position closes the current Segment at the playhead and opens a new one", () => {
    const session = run(freshMatch(), [
      { type: "start_segment", time: 100, position_id: "standing" },
      { type: "start_segment", time: 130, position_id: "closed_guard" },
      { type: "start_segment", time: 175.5, position_id: "half_guard" },
    ]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 130, position_id: "standing" },
      { start: 130, end: 175.5, position_id: "closed_guard" },
      { start: 175.5, end: 300, position_id: "half_guard" },
    ]);
  });

  it("starting a Segment inside an earlier Segment splits it and keeps the timeline tiled", () => {
    const session = run(freshMatch(), [
      { type: "start_segment", time: 100, position_id: "standing" },
      { type: "start_segment", time: 200, position_id: "mount" },
      { type: "start_segment", time: 150, position_id: "scramble" },
    ]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 150, position_id: "standing" },
      { start: 150, end: 200, position_id: "scramble" },
      { start: 200, end: 300, position_id: "mount" },
    ]);
  });

  it("rejects a Segment start outside the Match and leaves the document unchanged", () => {
    const before = run(freshMatch(), [{ type: "start_segment", time: 100, position_id: "standing" }]);

    for (const time of [99, 300, 301]) {
      const outcome = apply(before, { type: "start_segment", time, position_id: "mount" });
      expect(outcome.rejection).toBeDefined();
      expect(outcome.session.annotation).toEqual(before.annotation);
    }
  });

  it("rejects a Segment start exactly on an existing boundary", () => {
    const before = run(freshMatch(), [
      { type: "start_segment", time: 100, position_id: "standing" },
      { type: "start_segment", time: 150, position_id: "mount" },
    ]);

    const outcome = apply(before, { type: "start_segment", time: 150, position_id: "scramble" });

    expect(outcome.rejection).toBeDefined();
    expect(outcome.session.annotation).toEqual(before.annotation);
  });

  it("rejects an unknown Position", () => {
    const outcome = apply(freshMatch(), { type: "start_segment", time: 120, position_id: "flying_squirrel" });

    expect(outcome.rejection).toMatch(/flying_squirrel/);
  });

  it("rejects starting a Segment before the Match bounds are set", () => {
    const session = newSession(sampleContext(), {
      id: "test-match",
      annotator: "tester",
      source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
    });

    const outcome = apply(session, { type: "start_segment", time: 120, position_id: "standing" });

    expect(outcome.rejection).toBeDefined();
    expect(outcome.session.annotation.segments).toEqual([]);
  });
});
