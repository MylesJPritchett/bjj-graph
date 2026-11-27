import { describe, expect, it } from "vitest";
import { apply, newSession, violationsOf } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" } as const;
const setUp = () =>
  run(newSession(sampleContext(), { id: "test-match", annotator: "tester", source }), [
    { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
  ]);

describe("recording Score Events", () => {
  it("records a typed score Event at the playhead for the chosen Athlete", () => {
    const session = run(setUp(), [
      { type: "add_score_event", time: 168, athlete: "alex-example", score_type: "points", value: 3 },
    ]);

    expect(session.annotation.events).toEqual([
      { kind: "score", time: 168, athlete: "alex-example", score_type: "points", value: 3 },
    ]);
  });

  it("keeps the Event track in time order, whatever order Events are recorded in", () => {
    const session = run(setUp(), [
      { type: "add_score_event", time: 250, athlete: "alex-example", score_type: "points", value: 2 },
      { type: "add_score_event", time: 120, athlete: "sam-example", score_type: "advantage" },
    ]);

    expect(session.annotation.events.map((e) => e.time)).toEqual([120, 250]);
  });

  it("rejects a Score Event credited to someone who isn't one of the Match's Athletes", () => {
    expect(
      apply(setUp(), { type: "add_score_event", time: 150, athlete: "ghost-example", score_type: "penalty" }).rejection,
    ).toBeDefined();
  });
});

describe("editing and deleting Score Events", () => {
  const scored = () =>
    run(setUp(), [
      { type: "add_score_event", time: 150, athlete: "alex-example", score_type: "points", value: 2 },
      { type: "add_score_event", time: 200, athlete: "sam-example", score_type: "advantage" },
    ]);

  it("an edit changes the given fields, clears those set to null, and re-sorts the track", () => {
    const session = run(scored(), [
      {
        type: "edit_score_event",
        event: 0,
        set: { time: 260, athlete: "sam-example", score_type: "penalty", value: null },
      },
    ]);

    expect(session.annotation.events).toEqual([
      { kind: "score", time: 200, athlete: "sam-example", score_type: "advantage" },
      { kind: "score", time: 260, athlete: "sam-example", score_type: "penalty" },
    ]);
  });

  it("an edit keeps the fields it leaves out", () => {
    const session = run(scored(), [{ type: "edit_score_event", event: 0, set: { value: 3, note: "late call" } }]);

    expect(session.annotation.events[0]).toEqual({
      kind: "score",
      time: 150,
      athlete: "alex-example",
      score_type: "points",
      value: 3,
      note: "late call",
    });
  });

  it("undo restores a deleted Event", () => {
    const before = scored();
    const session = run(before, [{ type: "delete_score_event", event: 0 }, { type: "undo" }]);

    expect(session.annotation).toEqual(before.annotation);
  });

  it("deletes an Event", () => {
    const session = run(scored(), [{ type: "delete_score_event", event: 1 }]);

    expect(session.annotation.events).toEqual([
      { kind: "score", time: 150, athlete: "alex-example", score_type: "points", value: 2 },
    ]);
  });

  it("rejects editing or deleting an Event that doesn't exist", () => {
    expect(apply(scored(), { type: "delete_score_event", event: 5 }).rejection).toBeDefined();
    expect(
      apply(scored(), {
        type: "edit_score_event",
        event: 2,
        set: { time: 160, athlete: "alex-example", score_type: "advantage" },
      }).rejection,
    ).toBeDefined();
  });
});

describe("Score Events inside the Match bounds", () => {
  const outOfBounds = (session: ReturnType<typeof setUp>) =>
    violationsOf(session).filter((v) => v.rule === "score-event-in-match");

  it("flags a Score Event before the Match start or after its end, naming the Event", () => {
    const session = run(setUp(), [
      { type: "add_score_event", time: 90, athlete: "alex-example", score_type: "penalty" },
      { type: "add_score_event", time: 150, athlete: "alex-example", score_type: "advantage" },
      { type: "add_score_event", time: 310, athlete: "sam-example", score_type: "points", value: 2 },
    ]);

    expect(outOfBounds(session).map((v) => v.target)).toEqual([
      { kind: "event", index: 0 },
      { kind: "event", index: 2 },
    ]);
  });

  it("accepts Score Events exactly at the Match start and end (a tap ends the Match)", () => {
    const session = run(setUp(), [
      { type: "add_score_event", time: 100, athlete: "alex-example", score_type: "penalty" },
      { type: "add_score_event", time: 300, athlete: "alex-example", score_type: "submission_finish" },
    ]);

    expect(outOfBounds(session)).toEqual([]);
  });

  it("the flag follows the Match bounds when they move", () => {
    const session = run(setUp(), [
      { type: "add_score_event", time: 290, athlete: "alex-example", score_type: "points", value: 2 },
      { type: "set_match_end", time: 280 },
    ]);

    expect(outOfBounds(session).map((v) => v.target)).toEqual([{ kind: "event", index: 0 }]);
  });
});
