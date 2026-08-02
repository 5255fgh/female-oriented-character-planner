import prompt from "../../prompts/character-expansion.md?raw";

import {
  assertCharacterDraft,
  assertCreativeBrief,
  assertCreativeSeed,
  createId,
} from "../contracts.js";
import { generateBriefCharacterBundle } from "./brief-generator.js";

const CHARACTER_EXPANSION_PROMPT_VERSION = "character-expansion/v1";
const CONCEPT_CANDIDATE_KEYS = [
  "id",
  "name",
  "oneLiner",
  "coreExperience",
  "initialRelation",
  "coreConflict",
  "uniqueBehavior",
  "firstInteraction",
  "longTermPotential",
  "differenceSummary",
];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} value
 * @returns {import("../contracts.js").ConceptCandidate}
 */
function assertConceptCandidate(value) {
  if (!isPlainObject(value)) {
    throw new Error("ConceptCandidate: expected an object");
  }

  const expectedKeys = new Set(CONCEPT_CANDIDATE_KEYS);
  for (const key of Object.keys(value)) {
    if (!expectedKeys.has(key)) {
      throw new Error(`ConceptCandidate.${key}: unexpected field`);
    }
  }
  for (const key of CONCEPT_CANDIDATE_KEYS) {
    if (typeof value[key] !== "string") {
      throw new Error(`ConceptCandidate.${key}: expected a string`);
    }
  }

  return /** @type {import("../contracts.js").ConceptCandidate} */ (value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isMissingText(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

/**
 * @param {unknown} response
 * @param {string} conceptName
 * @returns {unknown}
 */
function finalizeCharacterDraft(response, preferredName) {
  if (!isPlainObject(response)) {
    throw new Error("CharacterDraft: expected an object");
  }
  if (!isPlainObject(response.publicInfo)) {
    throw new Error("CharacterDraft.publicInfo: expected an object");
  }
  if (
    response.meta !== undefined &&
    response.meta !== null &&
    !isPlainObject(response.meta)
  ) {
    throw new Error("CharacterDraft.meta: expected an object");
  }

  const modelMeta = isPlainObject(response.meta) ? response.meta : {};
  const allowedMetaKeys = new Set(["id", "name", "createdAt", "updatedAt"]);
  for (const key of Object.keys(modelMeta)) {
    if (!allowedMetaKeys.has(key)) {
      throw new Error(`CharacterDraft.meta.${key}: unexpected field`);
    }
  }

  const generatedName = isMissingText(response.publicInfo.name)
    ? modelMeta.name
    : response.publicInfo.name;
  const name = isMissingText(preferredName) ? generatedName : preferredName;
  if (isMissingText(name)) {
    throw new Error("CharacterDraft.publicInfo.name: expected a non-empty string");
  }

  const now = new Date().toISOString();
  const character = {
    ...response,
    meta: {
      id: createId("character"),
      name,
      createdAt: now,
      updatedAt: now,
    },
    publicInfo: {
      ...response.publicInfo,
      name,
    },
  };

  return assertCharacterDraft(character);
}

/**
 * @param {import("../contracts.js").ConceptCandidate} concept
 * @param {import("../contracts.js").CreativeBrief} brief
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../contracts.js").CharacterDraft>}
 */
export async function expandCharacter(concept, brief, llmClient) {
  assertCreativeBrief(brief);
  const validatedConcept = assertConceptCandidate(concept);

  const messages = [
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: [
        `提示词版本：${CHARACTER_EXPANSION_PROMPT_VERSION}`,
        "请把选中的概念扩展为完整 CharacterDraft。",
        `选中概念 JSON：\n${JSON.stringify(validatedConcept, null, 2)}`,
        `创作简报 JSON：\n${JSON.stringify(brief, null, 2)}`,
        "不得增加 CharacterDraft 合同外字段。",
      ].join("\n\n"),
    },
  ];

  const response = await llmClient.completeJson({
    task: "character-expansion",
    messages,
    maxTokens: 8192,
  });
  return finalizeCharacterDraft(response, validatedConcept.name);
}

/**
 * 默认入口：一次结构化调用直接生成一份简报和一个完整角色。
 *
 * @param {import("../contracts.js").CreativeSeed} seed
 * @param {Record<string, string>} answers
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{
 *   title: string,
 *   brief: import("../contracts.js").CreativeBrief,
 *   worldSummary: string | null,
 *   character: import("../contracts.js").CharacterDraft
 * }>}
 */
export async function generateCharacterFromSeed(
  seed,
  answers,
  llmClient,
  options = {},
) {
  assertCreativeSeed(seed);
  const generated = await generateBriefCharacterBundle(
    seed,
    answers,
    llmClient,
    options,
  );

  return {
    title: generated.title,
    brief: generated.brief,
    worldSummary: generated.worldSummary,
    character: finalizeCharacterDraft(generated.character),
  };
}
