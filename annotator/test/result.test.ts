import { describe, expect, it } from "vitest";
import { apply, newSession, openSession, violationsOf, type Session } from "../src/session/session";
import type { Annotation } from "../src/session/types";
import { readVocabJson, sampleContext } from "./helpers";
import { run } from "./run";

const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" } as const;
const setUp = () =>
  run(newSession(sampleContext(), { id: "test-match", annotator: "tester", source }), [
    { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
  ]);
const rulesBroken = (session: Session, rule: string) => violationsOf(session).filter((v) => v.rule === rule);

describe("recording the Result", () => {
  it("records a winner and a Method", () => {
    const session = run(setUp(), [{ type: "set_result", result: { winner: "sam-example", method: "points" } }]);

    expect(session.annotation.result).toEqual({ winner: "sam-example", method: "points" });
  });

  it("records a draw with no winner", () => {
    const session = run(setUp(), [{ type: "set_result", result: { method: "draw" } }]);

    expect(session.annotation.result).toEqual({ method: "draw" });
  });

  it("rejects a draw with a winner, a win without one, and a winner who isn't in the Match", () => {
    const session = setUp();
    expect(apply(session, { type: "set_result", result: { winner: "alex-example", method: "draw" } }).rejection).toBeDefined();
    expect(apply(session, { type: "set_result", result: { method: "submission" } }).rejection).toBeDefined();
    expect(
      apply(session, { type: "set_result", result: { winner: "ghost-example", method: "referee_decision" } }).rejection,
    ).toBeDefined();
  });

  it("clears the Result", () => {
    const session = run(setUp(), [
      { type: "set_result", result: { winner: "sam-example", method: "advantages" } },
      { type: "clear_result" },
    ]);

    expect(session.annotation.result).toBeUndefined();
  });
});

describe("a missing Result", () => {
  it("is flagged until a Result is recorded", () => {
    expect(rulesBroken(setUp(), "result-present")).toEqual([expect.objectContaining({ target: { kind: "result" } })]);

    const decided = run(setUp(), [{ type: "set_result", result: { method: "draw" } }]);
    expect(rulesBroken(decided, "result-present")).toEqual([]);
  });
});

describe("a submission Method needs a final submission-finish Score Event during a Submission Position", () => {
  // The sample: alex-example finishes a rear naked choke (290s to 302s) with a submission_finish at 302s.
  const finished = () => openSession(sampleContext(), readVocabJson<Annotation>("examples/sample-annotation.json"));
  const finishViolations = (session: Session) => rulesBroken(session, "submission-finish");

  it("a finish credited to the winner, as attacker, in the last Submission Position passes", () => {
    expect(finishViolations(finished())).toEqual([]);
  });

  it("flags a submission with no submission-finish Score Event", () => {
    const session = run(finished(), [{ type: "remove_score_event", index: 3 }]);

    expect(finishViolations(session)).toEqual([expect.objectContaining({ target: { kind: "result" } })]);
  });

  it("flags a submission finish that isn't the final Score Event", () => {
    const session = run(finished(), [
      { type: "edit_score_event", index: 3, event: { time: 295, athlete: "alex-example", score_type: "submission_finish" } },
      { type: "add_score_event", time: 298, athlete: "sam-example", score_type: "penalty" },
    ]);

    expect(finishViolations(session)).toHaveLength(1);
  });

  it("flags a finish credited to the losing Athlete", () => {
    const session = run(finished(), [
      { type: "edit_score_event", index: 3, event: { time: 302, athlete: "sam-example", score_type: "submission_finish" } },
    ]);

    expect(finishViolations(session)).toHaveLength(1);
  });

  it("flags a finish outside a Submission Position", () => {
    const session = run(finished(), [
      { type: "edit_score_event", index: 3, event: { time: 280, athlete: "alex-example", score_type: "submission_finish" } },
    ]);

    expect(finishViolations(session)).toHaveLength(1);
  });

  it("flags a finish in a Submission Position where the winner isn't the attacker", () => {
    const annotation = readVocabJson<Annotation>("examples/sample-annotation.json");
    annotation.segments[8]!.first_role_holder = "sam-example";

    expect(finishViolations(openSession(sampleContext(), annotation))).toHaveLength(1);
  });

  it("doesn't apply to other Methods", () => {
    const session = run(finished(), [
      { type: "remove_score_event", index: 3 },
      { type: "set_result", result: { winner: "alex-example", method: "points" } },
    ]);

    expect(finishViolations(session)).toEqual([]);
  });
});
