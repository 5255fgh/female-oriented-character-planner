import {
  assertExactKeys,
  assertObject,
  assertString,
  assertStringArray,
  fail,
} from "./common.js";

/**
 * @typedef {object} WorldBible
 * @property {string} summary
 * @property {string[]} rules
 * @property {string[]} locations
 * @property {string[]} factions
 * @property {string[]} canonFacts
 * @property {string[]} forbiddenFacts
 */

/**
 * @typedef {object} StoryDraft
 * @property {string} title
 * @property {string} oneLiner
 * @property {string} userIdentity
 * @property {string[]} mainCharacters
 * @property {string} premise
 * @property {string} coreConflict
 * @property {string} initialScene
 * @property {string} openingLine
 * @property {string[]} keyNodes
 * @property {string[]} branches
 * @property {string[]} foreshadowing
 * @property {string[]} stateVariables
 */

function assertMaximumLength(values, maximum, path) {
  if (values.length > maximum) {
    fail(path, `expected at most ${maximum} items`);
  }
}

/** @param {unknown} value @param {string} path */
export function validateWorldBible(value, path) {
  const world = assertObject(value, path);
  const keys = ["summary", "rules", "locations", "factions", "canonFacts", "forbiddenFacts"];
  assertExactKeys(world, keys, path);
  assertString(world.summary, `${path}.summary`);
  const rules = assertStringArray(world.rules, `${path}.rules`);
  const locations = assertStringArray(world.locations, `${path}.locations`);
  const factions = assertStringArray(world.factions, `${path}.factions`);
  assertMaximumLength(rules, 8, `${path}.rules`);
  assertMaximumLength(locations, 5, `${path}.locations`);
  assertMaximumLength(factions, 4, `${path}.factions`);
  assertStringArray(world.canonFacts, `${path}.canonFacts`);
  assertStringArray(world.forbiddenFacts, `${path}.forbiddenFacts`);
}

/** @param {unknown} value @param {string} path */
export function validateStoryDraft(value, path) {
  const story = assertObject(value, path);
  const keys = ["title", "oneLiner", "userIdentity", "mainCharacters", "premise", "coreConflict", "initialScene", "openingLine", "keyNodes", "branches", "foreshadowing", "stateVariables"];
  assertExactKeys(story, keys, path);
  for (const key of ["title", "oneLiner", "userIdentity", "premise", "coreConflict", "initialScene", "openingLine"]) {
    assertString(story[key], `${path}.${key}`);
  }
  assertStringArray(story.mainCharacters, `${path}.mainCharacters`);
  const keyNodes = assertStringArray(story.keyNodes, `${path}.keyNodes`);
  if (keyNodes.length !== 8) {
    fail(`${path}.keyNodes`, "expected exactly 8 items");
  }
  const branches = assertStringArray(story.branches, `${path}.branches`);
  const foreshadowing = assertStringArray(story.foreshadowing, `${path}.foreshadowing`);
  const stateVariables = assertStringArray(story.stateVariables, `${path}.stateVariables`);
  assertMaximumLength(branches, 4, `${path}.branches`);
  assertMaximumLength(foreshadowing, 6, `${path}.foreshadowing`);
  assertMaximumLength(stateVariables, 3, `${path}.stateVariables`);
}

/** @param {unknown} value @returns {WorldBible} */
export function assertWorldBible(value) {
  validateWorldBible(value, "WorldBible");
  return /** @type {WorldBible} */ (value);
}

/** @param {unknown} value @returns {StoryDraft} */
export function assertStoryDraft(value) {
  validateStoryDraft(value, "StoryDraft");
  return /** @type {StoryDraft} */ (value);
}
