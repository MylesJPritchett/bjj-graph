import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson, validator, errorsOf } from "./helpers.js";

const vocabulary = readJson("vocabulary.json");
const validateVocabulary = validator("vocabulary.schema.json");

const familyOf = (familyId) => vocabulary.positions.filter((p) => p.family === familyId);

test("the vocabulary validates against the vocabulary schema", () => {
  assert.ok(validateVocabulary(vocabulary), errorsOf(validateVocabulary));
});

test("the vocabulary schema rejects an asymmetric Position without Roles", () => {
  const broken = structuredClone(vocabulary);
  const asymmetric = broken.positions.find((p) => !p.symmetric);
  delete asymmetric.roles;
  assert.equal(validateVocabulary(broken), false);
});

test("the vocabulary schema rejects a symmetric Position with Roles", () => {
  const broken = structuredClone(vocabulary);
  const symmetric = broken.positions.find((p) => p.symmetric);
  symmetric.roles = ["a", "b"];
  assert.equal(validateVocabulary(broken), false);
});

test("the Families are exactly the ten MVP Families", () => {
  assert.deepEqual(
    vocabulary.families.map((f) => f.id).sort(),
    [
      "back",
      "guard",
      "half_guard",
      "leg_entanglement",
      "mount",
      "scramble",
      "side_control",
      "standing",
      "submission",
      "turtle",
    ],
  );
});

test("there are about 25 Positions, each in a known Family, and every Family has one", () => {
  assert.ok(vocabulary.positions.length >= 22 && vocabulary.positions.length <= 30);
  const familyIds = new Set(vocabulary.families.map((f) => f.id));
  for (const p of vocabulary.positions) assert.ok(familyIds.has(p.family), p.id);
  for (const id of familyIds) assert.ok(familyOf(id).length > 0, id);
});

test("Position ids and hotkeys are unique", () => {
  const ids = vocabulary.positions.map((p) => p.id);
  const hotkeys = vocabulary.positions.map((p) => p.hotkey);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(hotkeys).size, hotkeys.length);
});

test("no Position hotkey takes a key kept for playback, undo/redo or Score Events", () => {
  const kept = ["j", "k", "l", "y", "z", "p"];
  for (const p of vocabulary.positions) assert.ok(!kept.includes(p.hotkey), p.id);
});

test("leg entanglements are split into the named entanglements", () => {
  assert.deepEqual(
    familyOf("leg_entanglement").map((p) => p.id).sort(),
    ["backside_fifty_fifty", "fifty_fifty", "inside_sankaku", "outside_ashi", "single_leg_x"],
  );
});

test("every Submission Position has attacker / defender Roles", () => {
  const submissions = familyOf("submission");
  assert.ok(submissions.length >= 5);
  for (const p of submissions) {
    assert.equal(p.symmetric, false, p.id);
    assert.deepEqual(p.roles, ["attacker", "defender"], p.id);
  }
});

test("Scramble is a single symmetric Position", () => {
  assert.deepEqual(
    familyOf("scramble").map((p) => [p.id, p.symmetric]),
    [["scramble", true]],
  );
});

test("there are about 12 Transition types with unique ids, and only Reset takes no Initiator", () => {
  const ids = vocabulary.transitions.map((t) => t.id);
  assert.ok(ids.length >= 10 && ids.length <= 15);
  assert.equal(new Set(ids).size, ids.length);
  const hotkeys = vocabulary.transitions.map((t) => t.hotkey);
  assert.equal(new Set(hotkeys).size, hotkeys.length);
  assert.deepEqual(
    vocabulary.transitions.filter((t) => !t.takes_initiator).map((t) => t.id),
    ["reset"],
  );
});
