import { describe, expect, it } from "vitest";
import { openSession, violationsOf } from "../src/session/session";
import type { Annotation } from "../src/session/types";
import { readVocabJson, sampleContext } from "./helpers";

// Sample Segments: 0 standing, 1 open_guard (guard_pull), 2 half_guard, 3 side_control,
// 4 scramble (escape), 5 standing (reset), 6 turtle, 7 back_control, 8 rear_naked_choke.
const sample = () => readVocabJson<Annotation>("examples/sample-annotation.json");
const violationsFor = (rule: string, annotation: Annotation) =>
  violationsOf(openSession(sampleContext(), annotation)).filter((v) => v.rule === rule);

describe("Role holder by symmetry", () => {
  it("the sample Annotation has no Role holder violations", () => {
    expect(violationsFor("role-holder", sample())).toEqual([]);
  });

  it("flags a missing Role holder on an asymmetric Position, naming its Segment", () => {
    const annotation = sample();
    delete annotation.segments[3]!.first_role_holder;

    expect(violationsFor("role-holder", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 3 }, message: expect.stringMatching(/pinner/) }),
    ]);
  });

  it("flags a Role holder set on a symmetric Position", () => {
    const annotation = sample();
    annotation.segments[4]!.first_role_holder = "sam-example";

    expect(violationsFor("role-holder", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 4 }, message: expect.stringMatching(/symmetric/i) }),
    ]);
  });

  it("flags a Role holder who isn't one of the Match's Athletes", () => {
    const annotation = sample();
    annotation.segments[6]!.first_role_holder = "ghost-example";

    expect(violationsFor("role-holder", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 6 } }),
    ]);
  });
});

describe("each Segment after the first records the Transition that entered it", () => {
  it("the sample Annotation has no Transition violations", () => {
    expect(violationsFor("transition", sample())).toEqual([]);
  });

  it("flags a Segment after the first with no Transition", () => {
    const annotation = sample();
    delete annotation.segments[2]!.entered_by;

    expect(violationsFor("transition", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 2 } }),
    ]);
  });

  it("flags a Transition into the first Segment", () => {
    const annotation = sample();
    annotation.segments[0]!.entered_by = { transition_type: "reset" };

    expect(violationsFor("transition", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 0 } }),
    ]);
  });

  it("flags an unknown Transition type", () => {
    const annotation = sample();
    annotation.segments[2]!.entered_by = { transition_type: "teleport", initiator: "alex-example" };

    expect(violationsFor("transition", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 2 }, message: expect.stringMatching(/teleport/) }),
    ]);
  });
});

describe("Initiator by Transition type", () => {
  it("the sample Annotation has no Initiator violations", () => {
    expect(violationsFor("initiator", sample())).toEqual([]);
  });

  it("flags a missing Initiator on a non-Reset Transition, naming its Segment", () => {
    const annotation = sample();
    annotation.segments[3]!.entered_by = { transition_type: "pass" };

    expect(violationsFor("initiator", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 3 } }),
    ]);
  });

  it("flags an Initiator set on a Reset", () => {
    const annotation = sample();
    annotation.segments[5]!.entered_by = { transition_type: "reset", initiator: "sam-example" };

    expect(violationsFor("initiator", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 5 }, message: expect.stringMatching(/reset/i) }),
    ]);
  });

  it("flags an Initiator who isn't one of the Match's Athletes", () => {
    const annotation = sample();
    annotation.segments[7]!.entered_by = { transition_type: "back_take", initiator: "ghost-example" };

    expect(violationsFor("initiator", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 7 } }),
    ]);
  });
});

describe("the 3s minimum", () => {
  it("the sample Annotation has no Segment under 3s", () => {
    expect(violationsFor("minimum-duration", sample())).toEqual([]);
  });

  it("flags a Segment shorter than 3s, naming it", () => {
    const annotation = sample();
    annotation.segments[4]!.end = 202.5; // scramble from 200s
    annotation.segments[5]!.start = 202.5;

    expect(violationsFor("minimum-duration", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 4 } }),
    ]);
  });

  it("a Segment of exactly 3s is long enough", () => {
    const annotation = sample();
    annotation.segments[4]!.end = 203;
    annotation.segments[5]!.start = 203;

    expect(violationsFor("minimum-duration", annotation)).toEqual([]);
  });

  it("still flags a short final submission Segment (the Label Guide asks for a note that it was deliberate)", () => {
    const annotation = sample();
    annotation.segments[7]!.end = 300;
    annotation.segments[8]!.start = 300; // rear naked choke for the last 2s

    expect(violationsFor("minimum-duration", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 8 } }),
    ]);
  });
});

describe("adjacent Segments differ", () => {
  it("the sample Annotation has no adjacent duplicates", () => {
    expect(violationsFor("adjacent-duplicate", sample())).toEqual([]);
  });

  it("flags a Segment with the same Position and Role holder as the one before it, naming the later one", () => {
    const annotation = sample();
    annotation.segments[2] = { ...annotation.segments[2]!, position_id: "open_guard", first_role_holder: "sam-example" };

    expect(violationsFor("adjacent-duplicate", annotation)).toEqual([
      expect.objectContaining({ target: { kind: "segment", index: 2 } }),
    ]);
  });

  it("the same Position with the other Athlete in the first Role is a new Segment", () => {
    const annotation = sample();
    annotation.segments[2] = { ...annotation.segments[2]!, position_id: "open_guard", first_role_holder: "alex-example" };

    expect(violationsFor("adjacent-duplicate", annotation)).toEqual([]);
  });

  it("flags two adjacent symmetric Segments of the same Position", () => {
    const annotation = sample();
    const { first_role_holder: _holder, ...sideControl } = annotation.segments[3]!;
    annotation.segments[3] = { ...sideControl, position_id: "scramble" }; // then 4: scramble via escape

    expect(violationsFor("adjacent-duplicate", annotation).map((v) => v.target)).toEqual([{ kind: "segment", index: 4 }]);
  });

  it("the same Position either side of a Reset is fine", () => {
    const annotation = sample();
    annotation.segments[4] = { ...annotation.segments[4]!, position_id: "standing" }; // then 5: standing via reset

    expect(violationsFor("adjacent-duplicate", annotation)).toEqual([]);
  });
});
