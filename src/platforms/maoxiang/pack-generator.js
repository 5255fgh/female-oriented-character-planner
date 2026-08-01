import maoxiangPackPrompt from "../../../prompts/maoxiang-pack.md?raw";
import {
  assertCharacterDraft,
  assertPlatformPack,
  assertProjectDocument,
} from "../../contracts.js";
import { adaptMaoxiangFields } from "./adapters.js";
import {
  MAOXIANG_ADAPTER_FLOW_IDS,
  MAOXIANG_FLOW_STATUS,
  getMaoxiangRules,
} from "./rules.js";
import {
  validateMaoxiangFields,
  validatePlatformPack,
} from "./pack-validator.js";

const TASK_BY_LEGACY_FLOW = Object.freeze({
  free_character: "maoxiang-free-character",
  dead_rival: "maoxiang-dead-rival",
  image_shape: "maoxiang-image-shape",
});
const DEFAULT_IMAGE_STYLE = "通用";

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
  throw new Error("PlatformPack: generation aborted");
}

/**
 * @param {string} flowId
 * @param {Record<string, string>} fieldValues
 * @param {string} [generatedAt]
 * @returns {import("../../contracts.js").PlatformPack}
 */
function createPack(flowId, fieldValues, generatedAt = new Date().toISOString()) {
  return validatePlatformPack({
    platform: "maoxiang",
    flowId,
    blocks: validateMaoxiangFields(flowId, fieldValues),
    generatedAt,
  });
}

/**
 * @param {unknown} response
 * @param {string} flowId
 * @param {string[]} requestedIds
 * @returns {Record<string, string>}
 */
function extractModelFields(response, flowId, requestedIds) {
  if (!isPlainObject(response)) {
    throw new Error("模型响应必须是 JSON 对象。");
  }

  if (Array.isArray(response.blocks)) {
    const responsePack = assertPlatformPack(response);
    if (responsePack.platform !== "maoxiang" || responsePack.flowId !== flowId) {
      throw new Error(`模型返回了错误的猫箱入口，期望 "${flowId}"。`);
    }
    const byId = new Map(responsePack.blocks.map((block) => [block.id, block.text]));
    const fields = {};
    for (const fieldId of requestedIds) {
      if (!byId.has(fieldId)) {
        throw new Error(`模型响应缺少字段 "${fieldId}"。`);
      }
      fields[fieldId] = byId.get(fieldId);
    }
    return /** @type {Record<string, string>} */ (fields);
  }

  const requested = new Set(requestedIds);
  for (const key of Object.keys(response)) {
    if (!requested.has(key)) {
      throw new Error(`模型响应包含当前请求未允许的字段 "${key}"。`);
    }
  }

  const fields = {};
  const rules = getMaoxiangRules(flowId);
  for (const fieldId of requestedIds) {
    if (!Object.prototype.hasOwnProperty.call(response, fieldId)) {
      if (flowId === "image_shape" && fieldId === "styleSuggestion") {
        fields[fieldId] = DEFAULT_IMAGE_STYLE;
        continue;
      }
      if (!rules[fieldId].required) {
        fields[fieldId] = "";
        continue;
      }
      throw new Error(`模型响应缺少必填字段 "${fieldId}"。`);
    }
    if (typeof response[fieldId] !== "string") {
      throw new Error(`模型响应字段 "${fieldId}" 必须是字符串。`);
    }
    fields[fieldId] = response[fieldId];
  }

  if (
    flowId === "image_shape" &&
    !rules.styleSuggestion.allowedValues.includes(fields.styleSuggestion)
  ) {
    fields.styleSuggestion = DEFAULT_IMAGE_STYLE;
  }
  return /** @type {Record<string, string>} */ (fields);
}

/**
 * @param {object} character
 * @param {string} flowId
 * @param {string} task
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<Record<string, string>>}
 */
async function requestLegacyFields(character, flowId, task, llmClient) {
  const requestedIds = Object.keys(getMaoxiangRules(flowId));
  const messages = [
    { role: "system", content: maoxiangPackPrompt },
    {
      role: "user",
      content: JSON.stringify({ flowId, characterDraft: character }),
    },
  ];

  let validationError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestMessages = attempt === 0
      ? messages
      : [
          ...messages,
          {
            role: "user",
            content: `上一响应无效：${validationError.message}。请仅重试一次，只返回要求的字段 JSON。`,
          },
        ];
    const response = await llmClient.completeJson({
      task,
      messages: requestMessages,
      temperature: 0.4,
      maxTokens: 4096,
    });
    try {
      return extractModelFields(response, flowId, requestedIds);
    } catch (error) {
      validationError = /** @type {Error} */ (error);
      if (attempt === 1) {
        throw validationError;
      }
    }
  }
  throw validationError;
}

/** @param {import("../../contracts.js").PlatformPack} pack */
function findKnownOverLimitBlocks(pack) {
  return pack.blocks.filter(
    (block) =>
      typeof block.maxLength === "number" &&
      block.currentLength > block.maxLength,
  );
}

/**
 * @param {unknown} response
 * @param {string[]} requestedIds
 * @returns {Record<string, string>}
 */
function extractCompressedFields(response, requestedIds) {
  if (!isPlainObject(response)) {
    throw new Error("压缩响应必须是 JSON 对象");
  }
  const requested = new Set(requestedIds);
  for (const key of Object.keys(response)) {
    if (!requested.has(key)) {
      throw new Error(`压缩响应包含未请求字段 "${key}"`);
    }
  }
  const fields = {};
  for (const fieldId of requestedIds) {
    if (typeof response[fieldId] !== "string") {
      throw new Error(`压缩响应字段 "${fieldId}" 必须是字符串`);
    }
    fields[fieldId] = response[fieldId];
  }
  return /** @type {Record<string, string>} */ (fields);
}

/**
 * 每个输入包至多发起一次压缩请求；结果仍超限时保留全文并标记无效。
 *
 * @param {import("../../contracts.js").PlatformPack} pack
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<import("../../contracts.js").PlatformPack>}
 */
async function compressKnownOverLimitFields(pack, llmClient, signal) {
  const overLimitBlocks = findKnownOverLimitBlocks(pack);
  if (overLimitBlocks.length === 0) {
    return pack;
  }

  throwIfAborted(signal);
  const fields = Object.fromEntries(
    overLimitBlocks.map((block) => [
      block.id,
      {
        text: block.text,
        currentLength: block.currentLength,
        targetMaxLength: block.maxLength,
      },
    ]),
  );
  const request = {
    task: "maoxiang-compress-fields",
    messages: [
      { role: "system", content: maoxiangPackPrompt },
      {
        role: "user",
        content: JSON.stringify({
          operation: "compress-known-over-limit-fields-once",
          flowId: pack.flowId,
          instruction:
            "只压缩列出的已知超限字段，保留原意；只返回这些字段组成的 JSON 对象，不得返回完整输入包。",
          fields,
        }),
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
  };
  if (signal !== undefined) {
    request.signal = signal;
  }
  const response = await llmClient.completeJson(request);

  let compressedFields;
  try {
    compressedFields = extractCompressedFields(
      response,
      overLimitBlocks.map((block) => block.id),
    );
  } catch {
    return pack;
  }

  const nextBlocks = pack.blocks.map((block) => ({
    ...block,
    text: Object.prototype.hasOwnProperty.call(compressedFields, block.id)
      ? compressedFields[block.id]
      : block.text,
  }));
  return validatePlatformPack({ ...pack, blocks: nextBlocks });
}

/**
 * v2 统一项目适配器，支持五种声明式猫箱入口。
 *
 * @param {import("../../contracts.js").ProjectDocument} project
 * @param {string} flowId
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<import("../../contracts.js").PlatformPack>}
 */
export async function createMaoxiangPack(project, flowId, llmClient, options) {
  assertProjectDocument(project);
  if (!MAOXIANG_ADAPTER_FLOW_IDS.includes(flowId)) {
    throw new Error(
      `flowId: expected one of ${MAOXIANG_ADAPTER_FLOW_IDS.join(", ")}`,
    );
  }
  if (!MAOXIANG_FLOW_STATUS[flowId].enabled) {
    throw new Error(`猫箱入口 "${flowId}" 当前未启用。`);
  }
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }
  const { signal } = assertOptions(options);
  throwIfAborted(signal);

  const fieldValues = adaptMaoxiangFields(project, flowId);
  const pack = createPack(flowId, fieldValues);
  return compressKnownOverLimitFields(pack, llmClient, signal);
}

/**
 * 兼容现有角色入口；只返回数据，不操作 UI、浏览器或持久化。
 *
 * @param {import("../../contracts.js").CharacterDraft} character
 * @param {string} flowId
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../../contracts.js").PlatformPack>}
 */
export async function generateMaoxiangPack(character, flowId, llmClient) {
  assertCharacterDraft(character);
  const task = TASK_BY_LEGACY_FLOW[flowId];
  if (!task) {
    throw new Error(
      `猫箱兼容入口仅支持 ${Object.keys(TASK_BY_LEGACY_FLOW).join(", ")}。`,
    );
  }
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }

  const fieldValues = await requestLegacyFields(
    character,
    flowId,
    task,
    llmClient,
  );
  const pack = createPack(flowId, fieldValues);
  return compressKnownOverLimitFields(pack, llmClient, undefined);
}
