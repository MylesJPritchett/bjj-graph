import { describe, expect, it } from "vitest";
import { toJson } from "../src/session/serialize";
import { apply, newSession, openSession, type Command, type Session } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

const fresh = () =>
  newSession(sampleContext(), {
    id: "test-match",
    annotator: "tester",
    source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
  });

const setup: Command[] = [
  { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
  { type: "set_match_start", time: 100 },
  { type: "set_match_end", time: 300 },
  { type: "start_segment", time: 100, position_id: "standing" },
  { type: "start_segment", time: 150, position_id: "closed_guard" },
  { type: "start_segment", time: 200, position_id: "mount" },
];

/** The saved document plus the partial Match offsets: everything undo must put back. */
const documentOf = (session: Session) => ({ json: toJson(session.annotation), bounds: session.bounds });

describe("undo and redo", () => {
  it("undo restores the exact previous document after each kind of command", () => {
    const one: Command[] = [
      { type: "set_athletes", athletes: ["sam-example"] },
      { type: "set_match_start", time: 90 },
      { type: "set_match_end", time: 310 },
      { type: "start_segment", time: 260, position_id: "scramble" },
      { type: "move_boundary", segment: 2, time: 180 },
      { type: "edit_segment", segment: 1, set: { first_role_holder: "alex-example" } },
      { type: "delete_segment", segment: 1 },
    ];
    const labelled = run(fresh(), setup);

    for (const command of one) {
      const changed = run(labelled, [command]);
      expect(documentOf(changed)).not.toEqual(documentOf(labelled));

      const undone = run(changed, [{ type: "undo" }]);

      expect(undone.annotation).toEqual(labelled.annotation);
      expect(documentOf(undone)).toEqual(documentOf(labelled));
    }
  });

  it("undoes a whole sequence back to the empty Annotation, then redoes it all", () => {
    const empty = fresh();
    const labelled = run(empty, setup);

    const undone = run(labelled, setup.map(() => ({ type: "undo" }) as const));
    expect(documentOf(undone)).toEqual(documentOf(empty));

    const redone = run(undone, setup.map(() => ({ type: "redo" }) as const));
    expect(documentOf(redone)).toEqual(documentOf(labelled));
  });

  it("partial Match offsets come back with undo", () => {
    const started = run(fresh(), [{ type: "set_match_start", time: 42 }]);

    const undone = run(started, [{ type: "undo" }]);

    expect(undone.bounds).toEqual({});
  });

  it("a new command after an undo discards the redo", () => {
    const undone = run(fresh(), [...setup, { type: "undo" }]);

    const branched = run(undone, [{ type: "start_segment", time: 250, position_id: "back_control" }]);

    expect(apply(branched, { type: "redo" }).rejection).toBeDefined();
  });

  it("a rejected command leaves nothing to undo", () => {
    const labelled = run(fresh(), setup);
    const rejected = apply(labelled, { type: "move_boundary", segment: 1, time: 999 });
    expect(rejected.rejection).toBeDefined();

    const undone = run(rejected.session, [{ type: "undo" }]);

    expect(undone.annotation.segments).toHaveLength(2);
  });

  it("refuses undo with nothing done and redo with nothing undone", () => {
    expect(apply(fresh(), { type: "undo" }).rejection).toBeDefined();
    expect(apply(fresh(), { type: "redo" }).rejection).toBeDefined();
  });

  it("a reopened Annotation starts with no history", () => {
    const reopened = openSession(sampleContext(), run(fresh(), setup).annotation);

    expect(apply(reopened, { type: "undo" }).rejection).toBeDefined();
  });
});
