import { describe, expect, it } from "vitest";
import { apply, newSession, type Session } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

function labelledStart(): Session {
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
  ]);
}

describe("recording how a Segment was reached", () => {
  it("a new Segment records its Transition type, Initiator and first-Role holder", () => {
    const session = run(labelledStart(), [
      {
        type: "start_segment",
        time: 120,
        position_id: "closed_guard",
        entered_by: { transition_type: "guard_pull", initiator: "sam-example" },
        first_role_holder: "sam-example",
      },
    ]);

    expect(session.annotation.segments[1]).toEqual({
      start: 120,
      end: 300,
      position_id: "closed_guard",
      first_role_holder: "sam-example",
      entered_by: { transition_type: "guard_pull", initiator: "sam-example" },
    });
  });

  it("a Reset records no Initiator, and a symmetric Position no Role holder", () => {
    const session = run(labelledStart(), [
      { type: "start_segment", time: 150, position_id: "scramble", entered_by: { transition_type: "reset" } },
    ]);

    expect(session.annotation.segments[1]).toEqual({
      start: 150,
      end: 300,
      position_id: "scramble",
      entered_by: { transition_type: "reset" },
    });
  });

  it("splitting a Segment keeps the earlier part's Transition and Role holder", () => {
    const session = run(labelledStart(), [
      {
        type: "start_segment",
        time: 200,
        position_id: "mount",
        entered_by: { transition_type: "takedown", initiator: "alex-example" },
        first_role_holder: "alex-example",
      },
      {
        type: "start_segment",
        time: 250,
        position_id: "back_control",
        entered_by: { transition_type: "back_take", initiator: "alex-example" },
        first_role_holder: "alex-example",
      },
      { type: "start_segment", time: 220, position_id: "scramble", entered_by: { transition_type: "escape", initiator: "sam-example" } },
    ]);

    expect(session.annotation.segments.slice(1)).toEqual([
      {
        start: 200,
        end: 220,
        position_id: "mount",
        first_role_holder: "alex-example",
        entered_by: { transition_type: "takedown", initiator: "alex-example" },
      },
      { start: 220, end: 250, position_id: "scramble", entered_by: { transition_type: "escape", initiator: "sam-example" } },
      {
        start: 250,
        end: 300,
        position_id: "back_control",
        first_role_holder: "alex-example",
        entered_by: { transition_type: "back_take", initiator: "alex-example" },
      },
    ]);
  });

  it("rejects an unknown Transition type", () => {
    const outcome = apply(labelledStart(), {
      type: "start_segment",
      time: 120,
      position_id: "mount",
      entered_by: { transition_type: "teleport", initiator: "alex-example" },
    });

    expect(outcome.rejection).toMatch(/teleport/);
  });

  it("rejects an Initiator or Role holder who isn't one of the Match's Athletes", () => {
    const base = { type: "start_segment", time: 120, position_id: "mount" } as const;

    expect(
      apply(labelledStart(), { ...base, entered_by: { transition_type: "sweep", initiator: "nobody" } }).rejection,
    ).toMatch(/nobody/);
    expect(apply(labelledStart(), { ...base, first_role_holder: "nobody" }).rejection).toMatch(/nobody/);
  });

  it("rejects a Transition into the first Segment, which starts the Match", () => {
    const session = run(labelledStart(), []);
    const fresh = { ...session, annotation: { ...session.annotation, segments: [] } };

    const outcome = apply(fresh, {
      type: "start_segment",
      time: 100,
      position_id: "standing",
      entered_by: { transition_type: "reset" },
    });

    expect(outcome.rejection).toBeDefined();
  });
});
