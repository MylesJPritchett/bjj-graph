import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson } from "./helpers.js";

const vocabulary = readJson("vocabulary.json");
const sample = readJson("examples/sample-annotation.json");
const registry = readJson("examples/sample-athletes.json");

const positions = new Map(vocabulary.positions.map((p) => [p.id, p]));
const transitions = new Map(vocabulary.transitions.map((t) => [t.id, t]));

test("the sample Annotation is labelled with the current vocabulary version", () => {
  assert.equal(sample.vocabulary_version, vocabulary.version);
});

test("the sample Annotation's Athletes are in the sample Athlete registry", () => {
  for (const slug of sample.athletes) assert.ok(slug in registry.athletes, slug);
});

test("every sample Segment uses a known Position, with a Role holder exactly when asymmetric", () => {
  for (const segment of sample.segments) {
    const position = positions.get(segment.position_id);
    assert.ok(position, segment.position_id);
    assert.equal("first_role_holder" in segment, !position.symmetric, segment.position_id);
  }
});

test("every sample Transition uses a known type, with an Initiator exactly when the type takes one", () => {
  const [first, ...rest] = sample.segments;
  assert.equal(first.entered_by, undefined);
  for (const { entered_by } of rest) {
    const type = transitions.get(entered_by.transition_type);
    assert.ok(type, entered_by.transition_type);
    assert.equal("initiator" in entered_by, type.takes_initiator, type.id);
  }
});

test("the sample Segments tile the Match with no gaps and each lasts at least 3s", () => {
  let cursor = sample.match.start_offset;
  for (const segment of sample.segments) {
    assert.equal(segment.start, cursor);
    assert.ok(segment.end - segment.start >= 3);
    cursor = segment.end;
  }
  assert.equal(cursor, sample.match.end_offset);
});
