import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson, validator, errorsOf } from "./helpers.js";

const validateAnnotation = validator("annotation.schema.json");

test("the hand-written sample Annotation validates against the Annotation schema", () => {
  const sample = readJson("examples/sample-annotation.json");
  assert.ok(validateAnnotation(sample), errorsOf(validateAnnotation));
});

function sampleWith(change) {
  const annotation = readJson("examples/sample-annotation.json");
  change(annotation);
  return annotation;
}

test("an Annotation whose source has neither a video id nor a URL is rejected", () => {
  const annotation = sampleWith((a) => delete a.source.video_id);
  assert.equal(validateAnnotation(annotation), false);
});

test("a draw Result naming a winner is rejected", () => {
  const annotation = sampleWith((a) => (a.result = { winner: "alex-example", method: "draw" }));
  assert.equal(validateAnnotation(annotation), false);
});

test("a decisive Result without a winner is rejected", () => {
  const annotation = sampleWith((a) => (a.result = { method: "points" }));
  assert.equal(validateAnnotation(annotation), false);
});

test("an Event of an unknown kind is rejected", () => {
  const annotation = sampleWith((a) =>
    a.events.push({ kind: "attempt", time: 150, athlete: "sam-example" }),
  );
  assert.equal(validateAnnotation(annotation), false);
});

test("a work-in-progress Annotation with no bounds, Segments or Result still validates", () => {
  const annotation = sampleWith((a) => {
    delete a.match;
    delete a.result;
    a.athletes = [];
    a.segments = [];
    a.events = [];
    a.metadata = {};
  });
  assert.ok(validateAnnotation(annotation), errorsOf(validateAnnotation));
});

test("a re-label links to its original Annotation by id", () => {
  const annotation = sampleWith((a) => {
    a.id = "sample-0001-relabel-1";
    a.relabel_of = "sample-0001";
  });
  assert.ok(validateAnnotation(annotation), errorsOf(validateAnnotation));
});
