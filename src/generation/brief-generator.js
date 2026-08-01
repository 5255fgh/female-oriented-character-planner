import prompt from "../../prompts/brief-character-generation.md?raw";

import {
  assertCreativeBrief,
  assertCreativeSeed,
} from "../contracts.js";

const BRIEF_CHARACTER_PROMPT_VERSION = "brief-character-generation/v1";
const RESPONSE_KEYS = ["title", "brief", "worldSummary", "character"];
const BLOCKED_ANSWER_KEYS = new Set(["__proto__", "prototype", "constructor"]);

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
 * @param {string} path
 * @returns {string}
 */
function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

/**
 * @param {unknown} answers
 * @returns {Record<string, string>}
 */
function assertAnswers(answers) {
  if (!isPlainObject(answers)) {
    throw new Error("answers: expected an object");
  }

  for (const [key, value] of Object.entries(answers)) {
    if (BLOCKED_ANSWER_KEYS.has(key)) {
      throw new Error(`answers.${key}: unsafe answer key`);
    }
    if (typeof value !== "string") {
      throw new Error(`answers.${key}: expected a string`);
    }
  }

  return /** @type {Record<string, string>} */ (answers);
}

/**
 * @param {unknown} value
 * @returns {{title: string, brief: import("../contracts.js").CreativeBrief, worldSummary: string | null, character: Record<string, unknown>}}
 */
function assertBriefCharacterResponse(value) {
  if (!isPlainObject(value)) {
    throw new Error("DirectCharacterGeneration: expected an object");
  }

  const expectedKeys = new Set(RESPONSE_KEYS);
  for (const key of Object.keys(value)) {
    if (!expectedKeys.has(key)) {
      throw new Error(`DirectCharacterGeneration.${key}: unexpected field`);
    }
  }
  for (const key of RESPONSE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`DirectCharacterGeneration.${key}: missing field`);
    }
  }

  const title = assertNonEmptyString(value.title, "DirectCharacterGeneration.title");
  const brief = assertCreativeBrief(value.brief);
  if (
    value.worldSummary !== null &&
    (typeof value.worldSummary !== "string" || value.worldSummary.trim().length === 0)
  ) {
    throw new Error(
      "DirectCharacterGeneration.worldSummary: expected a non-empty string or null",
    );
  }
  if (!isPlainObject(value.character)) {
    throw new Error("DirectCharacterGeneration.character: expected an object");
  }

  return {
    title,
    brief,
    worldSummary: /** @type {string | null} */ (value.worldSummary),
    character: value.character,
  };
}

/**
 * 一次请求同时生成项目标题、简报、轻量世界摘要和角色正文。
 * 角色本地元数据由调用方统一覆盖，避免模型拥有 ID 与时间戳。
 *
 * @param {import("../contracts.js").CreativeSeed} seed
 * @param {Record<string, string>} answers
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 */
export async function generateBriefCharacterBundle(
  seed,
  answers,
  llmClient,
  options = {},
) {
  assertCreativeSeed(seed);
  const validatedAnswers = assertAnswers(answers);

  const messages = [
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: [
        `提示词版本：${BRIEF_CHARACTER_PROMPT_VERSION}`,
        `创作种子：${JSON.stringify(seed.text)}`,
        `已回答的关键问题 JSON：${JSON.stringify(validatedAnswers)}`,
        "未提供的答案表示用户选择跳过，请采用保守且连贯的默认推断。",
      ].join("\n\n"),
    },
  ];

  const response = await llmClient.completeJson({
    task: "direct-character-generation",
    messages,
    maxTokens: 8192,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  return assertBriefCharacterResponse(response);
}
