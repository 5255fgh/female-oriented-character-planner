import { cloneJsonValue } from "../contracts/common.js";

export const PROJECT_CHANGE_TYPES = Object.freeze([
  "seed",
  "brief",
  "character",
  "world",
  "story",
]);

const INVALIDATED_FIELDS = Object.freeze({
  seed: [
    "brief",
    "concepts",
    "selectedConceptId",
    "character",
    "worldBible",
    "storyDraft",
    "ruleReport",
    "simulationReport",
    "platformPacks",
  ],
  brief: [
    "concepts",
    "selectedConceptId",
    "character",
    "worldBible",
    "storyDraft",
    "ruleReport",
    "simulationReport",
    "platformPacks",
  ],
  character: ["storyDraft", "ruleReport", "simulationReport", "platformPacks"],
  world: ["storyDraft", "platformPacks"],
  story: ["platformPacks"],
});

const EMPTY_VALUES = Object.freeze({
  brief: null,
  concepts: [],
  selectedConceptId: null,
  character: null,
  worldBible: null,
  storyDraft: null,
  ruleReport: null,
  simulationReport: null,
  platformPacks: [],
});

/**
 * 返回失效后的独立项目副本；不会修改输入项目，也不会清除生成历史。
 *
 * @template {object} T
 * @param {T} project
 * @param {"seed" | "brief" | "character" | "world" | "story"} changeType
 * @returns {T}
 */
export function invalidateProject(project, changeType) {
  if (!Object.prototype.hasOwnProperty.call(INVALIDATED_FIELDS, changeType)) {
    throw new Error(`changeType: unknown project change "${String(changeType)}"`);
  }

  const nextProject = /** @type {T & Record<string, unknown>} */ (
    cloneJsonValue(/** @type {import("../contracts/common.js").JsonValue} */ (project))
  );
  for (const field of INVALIDATED_FIELDS[changeType]) {
    if (Object.prototype.hasOwnProperty.call(nextProject, field)) {
      nextProject[field] = cloneJsonValue(EMPTY_VALUES[field]);
    }
  }
  return nextProject;
}

/**
 * @param {"seed" | "brief" | "character" | "world" | "story"} changeType
 * @returns {string[]}
 */
export function getInvalidatedFields(changeType) {
  const fields = INVALIDATED_FIELDS[changeType];
  if (!fields) {
    throw new Error(`changeType: unknown project change "${String(changeType)}"`);
  }
  return [...fields];
}
