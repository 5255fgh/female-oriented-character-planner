import prompt from "../../prompts/world-generation.md?raw";

import {
  assertCharacterDraft,
  assertCreativeBrief,
  assertCreativeSeed,
  assertStoryDraft,
  assertWorldBible,
} from "../contracts.js";

const WORLD_GENERATION_PROMPT_VERSION = "world-generation/v1";
const CONTEXT_KEYS = new Set([
  "seed",
  "brief",
  "character",
  "worldBible",
  "storyDraft",
]);

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
 * @param {unknown} context
 * @returns {Record<string, unknown>}
 */
function assertGenerationContext(context) {
  if (!isPlainObject(context)) {
    throw new Error("context: expected an object");
  }

  for (const key of Object.keys(context)) {
    if (!CONTEXT_KEYS.has(key)) {
      throw new Error(`context.${key}: unexpected field`);
    }
  }

  const suppliedEntries = Object.entries(context).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  if (suppliedEntries.length === 0) {
    throw new Error("context: expected at least one generation input");
  }

  if (context.seed !== null && context.seed !== undefined) {
    assertCreativeSeed(context.seed);
  }
  if (context.brief !== null && context.brief !== undefined) {
    assertCreativeBrief(context.brief);
  }
  if (context.character !== null && context.character !== undefined) {
    assertCharacterDraft(context.character);
  }
  if (context.worldBible !== null && context.worldBible !== undefined) {
    assertWorldBible(context.worldBible);
  }
  if (context.storyDraft !== null && context.storyDraft !== undefined) {
    assertStoryDraft(context.storyDraft);
  }

  return context;
}

/**
 * @param {unknown} options
 * @returns {{signal?: AbortSignal}}
 */
function assertOptions(options) {
  if (options === undefined) {
    return {};
  }
  if (!isPlainObject(options)) {
    throw new Error("options: expected an object");
  }
  for (const key of Object.keys(options)) {
    if (key !== "signal") {
      throw new Error(`options.${key}: unexpected field`);
    }
  }
  if (
    options.signal !== undefined &&
    (options.signal === null || typeof options.signal !== "object")
  ) {
    throw new Error("options.signal: expected an AbortSignal");
  }
  return /** @type {{signal?: AbortSignal}} */ (options);
}

/** @param {AbortSignal | undefined} signal */
function throwIfAborted(signal) {
  if (!signal?.aborted) {
    return;
  }
  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
  }
  throw new Error("WorldBible: generation aborted");
}

/**
 * @param {Record<string, unknown>} context
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<import("../contracts.js").WorldBible>}
 */
async function requestWorldBible(context, llmClient, signal) {
  const messages = [
    { role: "system", content: prompt },
    {
      role: "user",
      content: [
        `提示词版本：${WORLD_GENERATION_PROMPT_VERSION}`,
        "请根据以下上下文生成共享 WorldBible。",
        "只保留角色行动、关系发展或故事冲突真正需要的世界信息。",
        `生成上下文 JSON：\n${JSON.stringify(context, null, 2)}`,
      ].join("\n\n"),
    },
  ];

  let validationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfAborted(signal);
    const requestMessages = attempt === 0
      ? messages
      : [
          ...messages,
          {
            role: "user",
            content: `上一响应未通过 WorldBible 校验：${validationError.message}。请仅重试一次，并只返回符合字段与数量限制的原始 JSON。`,
          },
        ];
    const request = {
      task: "world-generation",
      messages: requestMessages,
      temperature: 0.5,
      maxTokens: 4096,
    };
    if (signal !== undefined) {
      request.signal = signal;
    }
    const response = await llmClient.completeJson(request);
    try {
      return assertWorldBible(response);
    } catch (error) {
      validationError = /** @type {Error} */ (error);
      if (attempt === 1) {
        throw validationError;
      }
    }
  }

  throw validationError;
}

/**
 * 生成只包含当前角色或故事所需信息的共享世界设定。
 *
 * @param {Record<string, unknown>} context
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<import("../contracts.js").WorldBible>}
 */
export async function generateWorldBible(context, llmClient, options) {
  const validatedContext = assertGenerationContext(context);
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }
  const { signal } = assertOptions(options);
  return requestWorldBible(validatedContext, llmClient, signal);
}
