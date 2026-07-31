import prompt from "../../prompts/concept-generation.md?raw";

import {
  assertConceptCandidates,
  assertCreativeBrief,
} from "../contracts.js";

const CONCEPT_CANDIDATE_FIELDS = [
  "id: string",
  "name: string",
  "oneLiner: string",
  "coreExperience: string",
  "initialRelation: string",
  "coreConflict: string",
  "uniqueBehavior: string",
  "firstInteraction: string",
  "longTermPotential: string",
  "differenceSummary: string",
].join("\n");

const DISTINCT_DIMENSIONS = [
  "coreExperience",
  "initialRelation",
  "coreConflict",
];

/**
 * @param {unknown} response
 * @returns {unknown}
 */
function normalizeCandidates(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response !== null &&
    typeof response === "object" &&
    Object.prototype.hasOwnProperty.call(response, "candidates")
  ) {
    return /** @type {{candidates: unknown}} */ (response).candidates;
  }

  throw new Error(
    'ConceptCandidates: expected an array or an object with a "candidates" field',
  );
}

/**
 * @param {import("../contracts.js").ConceptCandidate[]} candidates
 */
function assertDistinctCandidates(candidates) {
  for (const field of DISTINCT_DIMENSIONS) {
    const values = candidates.map((candidate) => candidate[field].trim());
    if (new Set(values).size !== candidates.length) {
      throw new Error(
        `ConceptCandidates.${field}: expected all 3 candidates to be different`,
      );
    }
  }
}

/**
 * @param {import("../contracts.js").CreativeBrief} brief
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../contracts.js").ConceptCandidate[]>}
 */
export async function generateConcepts(brief, llmClient) {
  assertCreativeBrief(brief);

  const messages = [
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: [
        "请根据以下完整创作简报生成角色概念候选。",
        `创作简报 JSON：\n${JSON.stringify(brief, null, 2)}`,
        `ConceptCandidate 字段说明（每项必须且只能包含这些字段）：\n${CONCEPT_CANDIDATE_FIELDS}`,
        '顶层请返回 {"candidates":[...]}，其中 candidates 正好包含 3 项。',
      ].join("\n\n"),
    },
  ];

  const response = await llmClient.completeJson({
    task: "concept-generation",
    messages,
  });
  const candidates = assertConceptCandidates(normalizeCandidates(response));
  assertDistinctCandidates(candidates);
  return candidates;
}
