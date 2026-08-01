import { getValueAtPath } from "../contracts.js";

const CONTEXT_FIELDS = {
  publicInfo: {
    brief: [
      "worldSetting",
      "characterIdentity",
      "relationshipType",
      "interactionTone",
      "boundaries",
      "bannedBehaviors",
    ],
    worldBible: ["summary", "rules", "canonFacts", "forbiddenFacts"],
    character: {
      publicInfo: ["name", "oneLiner", "appearance", "tags"],
      persona: ["identity", "currentGoal", "contradiction"],
      relationship: ["initialRelation"],
    },
  },
  visual: {
    brief: ["worldSetting", "characterIdentity"],
    worldBible: ["summary", "locations", "canonFacts"],
    character: {
      publicInfo: ["name", "appearance", "tags"],
      persona: ["identity"],
      imageDesign: ["appearancePrompt", "styleSuggestion"],
    },
  },
  persona: {
    brief: [
      "worldSetting",
      "characterIdentity",
      "coreExperiences",
      "coreConflict",
      "personalityContradiction",
      "initiativeLevel",
      "boundaries",
      "bannedBehaviors",
    ],
    worldBible: ["summary", "rules", "canonFacts", "forbiddenFacts"],
    character: {
      publicInfo: ["name", "oneLiner", "tags"],
      persona: [
        "identity",
        "background",
        "currentGoal",
        "secret",
        "desire",
        "fear",
        "contradiction",
        "concreteBehaviors",
        "initiativeRules",
        "forbiddenBehaviors",
      ],
      relationship: ["initialRelation", "conflictPattern", "repairPattern"],
    },
  },
  relationship: {
    brief: [
      "worldSetting",
      "relationshipType",
      "coreConflict",
      "interactionTone",
      "boundaries",
      "bannedBehaviors",
    ],
    worldBible: ["summary", "rules", "canonFacts", "forbiddenFacts"],
    character: {
      publicInfo: ["name", "oneLiner"],
      persona: [
        "identity",
        "currentGoal",
        "desire",
        "fear",
        "contradiction",
        "initiativeRules",
        "forbiddenBehaviors",
      ],
      relationship: [
        "initialRelation",
        "attractionConditions",
        "stages",
        "conflictPattern",
        "repairPattern",
      ],
    },
  },
  dialogueStyle: {
    brief: ["interactionTone", "boundaries", "bannedBehaviors"],
    worldBible: ["summary", "rules", "canonFacts", "forbiddenFacts"],
    character: {
      publicInfo: ["name", "oneLiner"],
      persona: [
        "identity",
        "currentGoal",
        "contradiction",
        "concreteBehaviors",
        "initiativeRules",
        "forbiddenBehaviors",
      ],
      relationship: ["initialRelation", "stages", "conflictPattern", "repairPattern"],
      dialogueStyle: [
        "addressStyle",
        "sentenceStyle",
        "replyLength",
        "actionNarration",
        "emotionalExpression",
        "bannedPhrases",
        "examples",
      ],
    },
  },
  openings: {
    brief: ["worldSetting", "relationshipType", "coreConflict", "boundaries"],
    worldBible: [
      "summary",
      "rules",
      "locations",
      "factions",
      "canonFacts",
      "forbiddenFacts",
    ],
    character: {
      publicInfo: ["name", "oneLiner"],
      persona: [
        "identity",
        "currentGoal",
        "secret",
        "contradiction",
        "initiativeRules",
      ],
      relationship: ["initialRelation", "stages", "conflictPattern"],
      dialogueStyle: ["sentenceStyle", "actionNarration", "emotionalExpression"],
      openings: ["plotOpening", "dailyOpening", "tensionOpening"],
    },
  },
};

/** @param {unknown} value */
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {unknown} value @returns {unknown} */
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function selectKeys(value, keys) {
  if (!isPlainObject(value)) {
    return {};
  }
  return Object.fromEntries(
    keys
      .filter((key) => Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => [key, cloneValue(value[key])]),
  );
}

/**
 * @param {string} fieldPath
 * @returns {keyof typeof CONTEXT_FIELDS}
 */
function selectContextGroup(fieldPath) {
  const root = fieldPath.split(".")[0];
  if (root === "meta") {
    throw new Error("fieldPath: local character metadata cannot be regenerated");
  }
  if (root === "publicInfo" && fieldPath.startsWith("publicInfo.appearance")) {
    return "visual";
  }
  if (root === "imageDesign") {
    return "visual";
  }
  if (Object.prototype.hasOwnProperty.call(CONTEXT_FIELDS, root)) {
    return /** @type {keyof typeof CONTEXT_FIELDS} */ (root);
  }
  throw new Error(`fieldPath: unsupported character field "${fieldPath}"`);
}

/**
 * 依据静态字段分组裁剪上下文；不会返回故事、评估、平台包、历史或项目元数据。
 *
 * @param {Record<string, unknown>} project
 * @param {string} fieldPath
 * @returns {{brief: Record<string, unknown>, worldBible: Record<string, unknown> | null, character: Record<string, unknown>}}
 */
export function selectContextForField(project, fieldPath) {
  if (!isPlainObject(project)) {
    throw new Error("project: expected an object");
  }
  if (typeof fieldPath !== "string" || fieldPath.trim().length === 0) {
    throw new Error("fieldPath: expected a non-empty string");
  }
  if (!isPlainObject(project.character)) {
    throw new Error("project.character: expected a generated character");
  }

  // 先验证目标确实存在，避免通过上下文选择器静默扩展角色字段。
  getValueAtPath(project.character, fieldPath);
  const configuration = CONTEXT_FIELDS[selectContextGroup(fieldPath)];
  const character = Object.fromEntries(
    Object.entries(configuration.character)
      .map(([section, keys]) => [
        section,
        selectKeys(project.character[section], keys),
      ])
      .filter(([, sectionValue]) => Object.keys(sectionValue).length > 0),
  );

  return {
    brief: selectKeys(project.brief, configuration.brief),
    worldBible:
      project.worldBible === null || project.worldBible === undefined
        ? null
        : selectKeys(project.worldBible, configuration.worldBible),
    character,
  };
}
