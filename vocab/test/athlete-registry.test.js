import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson, validator, errorsOf } from "./helpers.js";

const validateRegistry = validator("athletes.schema.json");

test("the shared Athlete registry validates", () => {
  const registry = readJson("athletes.json");
  assert.ok(validateRegistry(registry), errorsOf(validateRegistry));
});

test("the sample Athlete registry, with external links, validates", () => {
  const registry = readJson("examples/sample-athletes.json");
  assert.ok(validateRegistry(registry), errorsOf(validateRegistry));
});

test("an Athlete slug that is not lowercase kebab-case is rejected", () => {
  const registry = { athletes: { "Alex Example": { name: "Alex Example" } } };
  assert.equal(validateRegistry(registry), false);
});

test("an Athlete without a display name is rejected", () => {
  const registry = { athletes: { "alex-example": { links: {} } } };
  assert.equal(validateRegistry(registry), false);
});
