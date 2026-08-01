import prompt from "../../prompts/story-generation.md?raw";

import {
  assertCharacterDraft,
  assertCreativeBrief,
  assertCreativeSeed,
  assertStoryDraft,
  assertWorldBible,
} from "../contracts.js";

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

/**
 * @param {Record<string, unknown>} context
 * @returns {string[]}
 */
function extractMainCharacterInputs(context) {
  const names = [];
  if (context.character) {
    const character = /** @type {import("../contracts.js").CharacterDraft} */ (
      context.character
    );
    names.push(character.publicInfo.name);
  }
  if (context.storyDraft) {
    const story = /** @type {import("../contracts.js").StoryDraft} */ (
      context.storyDraft
    );
    names.push(...story.mainCharacters);
  }
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

/** @param {AbortSignal | undefined} signal */
function throwIfAborted(signal) {
  if (!signal?.aborted) {
    return;
  }
  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
  }
  throw new Error("StoryDraft: generation aborted");
}

/**
 * @param {Record<string, unknown>} context
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<import("../contracts.js").StoryDraft>}
 */
async function requestStoryDraft(context, llmClient, signal) {
  const mainCharacterInputs = extractMainCharacterInputs(context);
  const messages = [
    { role: "system", content: prompt },
    {
      role: "user",
      content: [
        "请根据以下上下文生成开放 StoryDraft。",
        mainCharacterInputs.length > 0
          ? `从上下文提取出的主要角色生成输入：${JSON.stringify(mainCharacterInputs)}`
          : "上下文没有既有主要角色，请根据 seed、brief 与世界设定确定必要角色。",
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
            content: `上一响应未通过 StoryDraft 校验：${validationError.message}。请仅重试一次，确保 keyNodes 正好 8 项并只返回原始 JSON。`,
          },
        ];
    const request = {
      task: "story-generation",
      messages: requestMessages,
      temperature: 0.6,
      maxTokens: 8192,
    };
    if (signal !== undefined) {
      request.signal = signal;
    }
    const response = await llmClient.completeJson(request);
    try {
      return assertStoryDraft(response);
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
 * 生成开放故事结构，不扩写几十章正文。
 *
 * @param {Record<string, unknown>} context
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<import("../contracts.js").StoryDraft>}
 */
export async function generateStoryDraft(context, llmClient, options) {
  const validatedContext = assertGenerationContext(context);
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }
  const { signal } = assertOptions(options);
  return requestStoryDraft(validatedContext, llmClient, signal);
}
