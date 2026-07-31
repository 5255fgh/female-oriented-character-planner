import prompt from "../../prompts/character-expansion.md?raw";

import {
  assertCharacterDraft,
  assertCreativeBrief,
  createId,
} from "../contracts.js";

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
function fillCharacterDefaults(response, conceptName) {
  if (!isPlainObject(response)) {
    return response;
  }

  const character = { ...response };
  const now = new Date().toISOString();

  if (
    response.meta === undefined ||
    response.meta === null ||
    isPlainObject(response.meta)
  ) {
    const meta = isPlainObject(response.meta) ? { ...response.meta } : {};
    if (isMissingText(meta.id)) {
      meta.id = createId("character");
    }
    if (isMissingText(meta.createdAt)) {
      meta.createdAt = now;
    }
    if (isMissingText(meta.updatedAt)) {
      meta.updatedAt = now;
    }
    if (isMissingText(meta.name)) {
      meta.name = conceptName;
    }
    character.meta = meta;
  }

  if (
    response.publicInfo === undefined ||
    response.publicInfo === null ||
    isPlainObject(response.publicInfo)
  ) {
    const publicInfo = isPlainObject(response.publicInfo)
      ? { ...response.publicInfo }
      : {};
    if (isMissingText(publicInfo.name)) {
      publicInfo.name = conceptName;
    }
    character.publicInfo = publicInfo;
  }

  return character;
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
  });
  const character = fillCharacterDefaults(response, validatedConcept.name);
  return assertCharacterDraft(character);
}
