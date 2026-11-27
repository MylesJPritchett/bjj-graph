import { describe, expect, it } from "vitest";
import { newSession, type Session } from "../src/session/session";
import { answerSegmentPrompt, openSegmentPrompt, type SegmentPrompt } from "../src/session/segment-prompt";
import { sampleContext } from "./helpers";
import { run } from "./run";

function matchWithAthletes(): Session {
  const session = newSession(sampleContext(), {
    id: "test-match",
    annotator: "tester",
    source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
  });
  return run(session, [
    { type: "set_athletes", athletes: ["alex-example", "sam-example"] },
    { type: "set_match_start", time: 100 },
    { type: "set_match_end", time: 300 },
  ]);
}

const underway = () => run(matchWithAthletes(), [{ type: "start_segment", time: 100, position_id: "standing" }]);

function open(session: Session, position_id: string): SegmentPrompt {
  const { prompt, rejection } = openSegmentPrompt(session, { time: 150, position_id });
  if (!prompt) throw new Error(rejection);
  return prompt;
}

const press = (prompt: SegmentPrompt, ...keys: string[]) => keys.reduce(answerSegmentPrompt, prompt);

describe("the prompt after a Position hotkey", () => {
  it("asks for the Transition type, then the Initiator, then the first-Role holder", () => {
    let prompt = open(underway(), "closed_guard");
    expect(prompt.step?.kind).toBe("transition_type");
    expect(prompt.step?.options).toContainEqual({ key: "g", label: "Guard pull" });

    prompt = press(prompt, "g");
    expect(prompt.step?.kind).toBe("initiator");
    expect(prompt.step?.options).toEqual([
      { key: "1", label: "Alex Example" },
      { key: "2", label: "Sam Example" },
    ]);

    prompt = press(prompt, "2");
    expect(prompt.step).toMatchObject({ kind: "role_holder", question: expect.stringMatching(/guard/) });

    prompt = press(prompt, "2");
    expect(prompt.step).toBeUndefined();
    expect(prompt.command).toEqual({
      type: "start_segment",
      time: 150,
      position_id: "closed_guard",
      entered_by: { transition_type: "guard_pull", initiator: "sam-example" },
      first_role_holder: "sam-example",
    });
  });

  it("skips the Role holder for a symmetric Position", () => {
    const prompt = press(open(underway(), "scramble"), "e", "1");

    expect(prompt.step).toBeUndefined();
    expect(prompt.command).toEqual({
      type: "start_segment",
      time: 150,
      position_id: "scramble",
      entered_by: { transition_type: "escape", initiator: "alex-example" },
    });
  });

  it("skips the Initiator for a Reset", () => {
    const prompt = press(open(underway(), "half_guard"), "r");

    expect(prompt.step?.kind).toBe("role_holder");
    expect(press(prompt, "1").command).toEqual({
      type: "start_segment",
      time: 150,
      position_id: "half_guard",
      entered_by: { transition_type: "reset" },
      first_role_holder: "alex-example",
    });
  });

  it("the first Segment asks for no Transition", () => {
    expect(open(matchWithAthletes(), "standing").step).toBeUndefined();
    expect(open(matchWithAthletes(), "leg_attack").step?.kind).toBe("role_holder");
  });

  it("ignores keys that aren't one of the current options", () => {
    const prompt = open(underway(), "mount");

    expect(press(prompt, "9", "Q")).toEqual(prompt);
  });

  it("refuses to open when it would need Athletes that aren't picked yet", () => {
    const session = newSession(sampleContext(), {
      id: "test-match",
      annotator: "tester",
      source: { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" },
    });
    const bounded = run(session, [
      { type: "set_match_start", time: 100 },
      { type: "set_match_end", time: 300 },
      { type: "start_segment", time: 100, position_id: "standing" },
    ]);

    expect(openSegmentPrompt(bounded, { time: 150, position_id: "mount" }).rejection).toMatch(/Athletes/);
  });

  it("refuses up front when no Segment could start at the playhead", () => {
    expect(openSegmentPrompt(underway(), { time: 100, position_id: "mount" }).rejection).toMatch(/already starts/);
    expect(openSegmentPrompt(underway(), { time: 400, position_id: "mount" }).rejection).toMatch(/outside/);
  });

  it("refuses an unknown Position", () => {
    expect(openSegmentPrompt(underway(), { time: 150, position_id: "flying_squirrel" }).rejection).toMatch(
      /flying_squirrel/,
    );
  });
});
