import { describe, expect, it } from "vitest";
import { apply, newSession, violationsOf, type Session } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

/** A Match from 100s to 300s with three Segments: standing, closed guard, mount. */
function labelledMatch(): Session {
  const session = newSession(sampleContext(), {
    id: "test-match",
    annotator: "tester",
    source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
  });
  return run(session, [
    { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
    { type: "start_segment", time: 100, position_id: "standing" },
    { type: "start_segment", time: 150, position_id: "closed_guard" },
    { type: "start_segment", time: 200, position_id: "mount" },
  ]);
}

const tilingViolations = (session: Session) =>
  violationsOf(session).filter((v) => v.rule === "segments-tile-match");

describe("moving a boundary", () => {
  it("retimes both adjacent Segments and keeps them contiguous", () => {
    const session = run(labelledMatch(), [{ type: "move_boundary", segment: 2, time: 180 }]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 150, position_id: "standing" },
      { start: 150, end: 180, position_id: "closed_guard" },
      { start: 180, end: 300, position_id: "mount" },
    ]);
    expect(tilingViolations(session)).toEqual([]);
  });

  it("a drag that leaves a Segment under 3s flags the minimum duration on that Segment", () => {
    const session = run(labelledMatch(), [{ type: "move_boundary", segment: 1, time: 198 }]);

    const short = violationsOf(session).filter((v) => v.rule === "minimum-duration");
    expect(short).toHaveLength(1);
    expect(short[0]!.target).toEqual({ kind: "segment", index: 1 });
  });

  it("rejects a drag past either neighbour's far edge", () => {
    const before = labelledMatch();

    for (const time of [150, 140, 300, 310]) {
      const outcome = apply(before, { type: "move_boundary", segment: 2, time });
      expect(outcome.rejection).toBeDefined();
      expect(outcome.session.annotation).toEqual(before.annotation);
    }
  });

  it("rejects moving the Match start or end as if it were a boundary", () => {
    const before = labelledMatch();

    expect(apply(before, { type: "move_boundary", segment: 0, time: 110 }).rejection).toBeDefined();
    expect(apply(before, { type: "move_boundary", segment: 3, time: 290 }).rejection).toBeDefined();
  });
});

describe("editing a Segment", () => {
  it("changes its Position, Role holder and incoming Transition without moving it", () => {
    const session = run(labelledMatch(), [
      {
        type: "edit_segment",
        segment: 1,
        set: {
          position_id: "half_guard",
          first_role_holder: "sam-example",
          entered_by: { transition_type: "guard_pull", initiator: "sam-example" },
        },
      },
    ]);

    expect(session.annotation.segments[1]).toEqual({
      start: 150,
      end: 200,
      position_id: "half_guard",
      first_role_holder: "sam-example",
      entered_by: { transition_type: "guard_pull", initiator: "sam-example" },
    });
  });

  it("null clears a field, and fields not mentioned are kept", () => {
    const labelled = run(labelledMatch(), [
      { type: "edit_segment", segment: 1, set: { first_role_holder: "sam-example", entered_by: { transition_type: "reset" } } },
    ]);

    const session = run(labelled, [{ type: "edit_segment", segment: 1, set: { first_role_holder: null } }]);

    expect(session.annotation.segments[1]).toEqual({
      start: 150,
      end: 200,
      position_id: "closed_guard",
      entered_by: { transition_type: "reset" },
    });
  });

  it("rejects edits that name things that don't exist", () => {
    const before = labelledMatch();
    const rejected = [
      { segment: 5, set: { position_id: "mount" } },
      { segment: 1, set: { position_id: "flying_squirrel" } },
      { segment: 1, set: { first_role_holder: "nobody-example" } },
      { segment: 1, set: { entered_by: { transition_type: "teleport" } } },
      { segment: 1, set: { entered_by: { transition_type: "sweep", initiator: "nobody-example" } } },
    ];

    for (const edit of rejected) {
      const outcome = apply(before, { type: "edit_segment", ...edit });
      expect(outcome.rejection).toBeDefined();
      expect(outcome.session.annotation).toEqual(before.annotation);
    }
  });

  it("rejects an incoming Transition on the first Segment", () => {
    const outcome = apply(labelledMatch(), {
      type: "edit_segment",
      segment: 0,
      set: { entered_by: { transition_type: "takedown", initiator: "alex-example" } },
    });

    expect(outcome.rejection).toBeDefined();
  });
});

describe("deleting a Segment", () => {
  it("a Segment that becomes the first loses its incoming Transition", () => {
    const withTransition = run(labelledMatch(), [
      { type: "edit_segment", segment: 1, set: { entered_by: { transition_type: "guard_pull", initiator: "alex-example" } } },
    ]);

    const session = run(withTransition, [{ type: "delete_segment", segment: 0 }]);

    expect(session.annotation.segments[0]).toEqual({ start: 100, end: 200, position_id: "closed_guard" });
  });

  it("the previous Segment absorbs a deleted Segment's time, keeping the timeline gap-free", () => {
    const session = run(labelledMatch(), [{ type: "delete_segment", segment: 1 }]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 200, position_id: "standing" },
      { start: 200, end: 300, position_id: "mount" },
    ]);
    expect(tilingViolations(session)).toEqual([]);
  });

  it("the next Segment can absorb the time instead", () => {
    const session = run(labelledMatch(), [{ type: "delete_segment", segment: 1, absorbed_by: "next" }]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 150, position_id: "standing" },
      { start: 150, end: 300, position_id: "mount" },
    ]);
    expect(tilingViolations(session)).toEqual([]);
  });

  it("deleting the first Segment stretches the next one back to the Match start", () => {
    const session = run(labelledMatch(), [{ type: "delete_segment", segment: 0 }]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 200, position_id: "closed_guard" },
      { start: 200, end: 300, position_id: "mount" },
    ]);
    expect(tilingViolations(session)).toEqual([]);
  });

  it("deleting the last Segment stretches the one before it to the Match end", () => {
    const session = run(labelledMatch(), [{ type: "delete_segment", segment: 2, absorbed_by: "next" }]);

    expect(session.annotation.segments).toEqual([
      { start: 100, end: 150, position_id: "standing" },
      { start: 150, end: 300, position_id: "closed_guard" },
    ]);
  });

  it("deleting the only Segment leaves an empty timeline", () => {
    const one = run(labelledMatch(), [
      { type: "delete_segment", segment: 2 },
      { type: "delete_segment", segment: 1 },
    ]);

    expect(run(one, [{ type: "delete_segment", segment: 0 }]).annotation.segments).toEqual([]);
  });

  it("rejects deleting a Segment that doesn't exist", () => {
    expect(apply(labelledMatch(), { type: "delete_segment", segment: 3 }).rejection).toBeDefined();
  });
});
