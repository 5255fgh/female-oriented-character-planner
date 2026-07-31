import maoxiangPackPrompt from "../../../prompts/maoxiang-pack.md?raw";
import {
  assertCharacterDraft,
  assertPlatformPack,
  countUnicodeCharacters,
} from "../../contracts.js";
import { MAOXIANG_FLOWS } from "./config.js";
import { validatePlatformPack } from "./pack-validator.js";

const TASK_BY_FLOW = Object.freeze({
  free_character: "maoxiang-free-character",
  dead_rival: "maoxiang-dead-rival",
  image_shape: "maoxiang-image-shape",
});

const COMPRESSIBLE_BLOCK_IDS = new Set(["characterPrompt", "rivalSetting"]);
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
 * @param {string} flowId
 * @returns {Record<string, unknown>}
 */
function getEnabledFlow(flowId) {
  if (!Object.prototype.hasOwnProperty.call(MAOXIANG_FLOWS, flowId)) {
    throw new Error(`猫箱入口 flowId "${String(flowId)}" 不存在。`);
  }

  if (flowId === "open_story") {
    throw new Error("猫箱 open_story 入口在 MVP 中已禁用，不能生成开放故事输入包。");
  }

  const flow = MAOXIANG_FLOWS[flowId];
  if (!flow.enabled) {
    throw new Error(`猫箱入口 "${flowId}" 当前未启用。`);
  }
  return flow;
}

/**
 * @param {Record<string, unknown>} flow
 * @returns {Array<[string, Record<string, unknown>]>}
 */
function getFieldEntries(flow) {
  return Object.entries(flow).filter(([key]) => key !== "enabled");
}

/**
 * @param {unknown} response
 * @param {string} flowId
 * @param {Array<[string, Record<string, unknown>]>} requestedFields
 * @returns {Record<string, unknown>}
 */
function extractFlowContent(response, flowId, requestedFields) {
  if (!isPlainObject(response)) {
    throw new Error("模型响应必须是 JSON 对象。");
  }

  if (Array.isArray(response.blocks)) {
    assertPlatformPack(response);
    if (response.platform !== "maoxiang" || response.flowId !== flowId) {
      throw new Error(`模型返回了错误的猫箱入口，期望 "${flowId}"。`);
    }

    const blocksById = new Map(response.blocks.map((block) => [block.id, block.text]));
    const content = {};
    for (const [fieldId] of requestedFields) {
      if (!blocksById.has(fieldId)) {
        throw new Error(`模型响应缺少字段 "${fieldId}"。`);
      }
      content[fieldId] = blocksById.get(fieldId);
    }
    return content;
  }

  const requestedIds = new Set(requestedFields.map(([fieldId]) => fieldId));
  for (const key of Object.keys(response)) {
    if (!requestedIds.has(key)) {
      throw new Error(`模型响应包含当前请求未允许的字段 "${key}"。`);
    }
  }

  const content = {};
  for (const [fieldId, fieldConfig] of requestedFields) {
    const hasField = Object.prototype.hasOwnProperty.call(response, fieldId);
    const canUseStyleFallback = flowId === "image_shape" && fieldId === "styleSuggestion";

    if (!hasField) {
      if (canUseStyleFallback) {
        content[fieldId] = DEFAULT_IMAGE_STYLE;
        continue;
      }
      if (fieldConfig.required) {
        throw new Error(`模型响应缺少必填字段 "${fieldId}"。`);
      }
      content[fieldId] = "";
      continue;
    }

    const value = response[fieldId];
    if (canUseStyleFallback) {
      content[fieldId] = value;
      continue;
    }
    if (typeof value !== "string") {
      throw new Error(`模型响应字段 "${fieldId}" 必须是字符串。`);
    }
    content[fieldId] = value;
  }
  return content;
}

/**
 * @param {Record<string, unknown>} content
 * @param {Array<[string, Record<string, unknown>]>} fieldEntries
 */
function normalizeImageStyle(content, fieldEntries) {
  const styleEntry = fieldEntries.find(([fieldId]) => fieldId === "styleSuggestion");
  if (!styleEntry) {
    return;
  }

  const allowedValues = styleEntry[1].allowedValues;
  if (!Array.isArray(allowedValues) || !allowedValues.includes(content.styleSuggestion)) {
    content.styleSuggestion = DEFAULT_IMAGE_STYLE;
  }
}

/**
 * @param {Record<string, unknown>} content
 * @param {Array<[string, Record<string, unknown>]>} fieldEntries
 * @returns {import("../../contracts.js").PlatformBlock[]}
 */
function createBlocks(content, fieldEntries) {
  return fieldEntries.map(([id, fieldConfig]) => {
    const text = content[id];
    if (typeof text !== "string") {
      throw new Error(`模型响应字段 "${id}" 必须是字符串。`);
    }

    const currentLength = countUnicodeCharacters(text);
    const lengthValid =
      fieldConfig.maxLength === null || currentLength <= fieldConfig.maxLength;
    const enumValid =
      !fieldConfig.allowedValues || fieldConfig.allowedValues.includes(text);

    return {
      id,
      label: fieldConfig.label,
      text,
      maxLength: fieldConfig.maxLength,
      currentLength,
      valid: lengthValid && enumValid,
      verified: fieldConfig.verified,
    };
  });
}

/**
 * @param {object} character
 * @param {string} flowId
 * @param {string} task
 * @param {Array<[string, Record<string, unknown>]>} fieldEntries
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<Record<string, unknown>>}
 */
async function requestMainContent(character, flowId, task, fieldEntries, llmClient) {
  const response = await llmClient.completeJson({
    task,
    messages: [
      { role: "system", content: maoxiangPackPrompt },
      {
        role: "user",
        content: JSON.stringify({ flowId, characterDraft: character }),
      },
    ],
    temperature: 0.4,
    maxTokens: 4096,
  });
  const content = extractFlowContent(response, flowId, fieldEntries);
  if (flowId === "image_shape") {
    normalizeImageStyle(content, fieldEntries);
  }
  return content;
}

/**
 * @param {import("../../contracts.js").PlatformPack} pack
 * @returns {import("../../contracts.js").PlatformBlock[]}
 */
function findOverLimitBlocks(pack) {
  return pack.blocks.filter(
    (block) =>
      COMPRESSIBLE_BLOCK_IDS.has(block.id) &&
      typeof block.maxLength === "number" &&
      block.currentLength > block.maxLength,
  );
}

/**
 * @param {import("../../contracts.js").PlatformPack} pack
 * @param {string} task
 * @param {Record<string, unknown>} flow
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../../contracts.js").PlatformPack>}
 */
async function compressOverLimitBlocks(pack, task, flow, llmClient) {
  const overLimitBlocks = findOverLimitBlocks(pack);
  if (overLimitBlocks.length === 0) {
    return pack;
  }

  const requestedFields = overLimitBlocks.map((block) => [block.id, flow[block.id]]);
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
  const response = await llmClient.completeJson({
    task,
    messages: [
      { role: "system", content: maoxiangPackPrompt },
      {
        role: "user",
        content: JSON.stringify({
          operation: "compress-over-limit-fields",
          flowId: pack.flowId,
          instruction:
            "只压缩列出的超限字段。每个字段都必须从 currentLength 压缩到不超过 targetMaxLength；只返回这些字段组成的 JSON 对象。",
          fields,
        }),
      },
    ],
    temperature: 0.2,
    maxTokens: 4096,
  });
  const compressedContent = extractFlowContent(response, pack.flowId, requestedFields);

  const compressedPack = {
    ...pack,
    blocks: pack.blocks.map((block) => {
      if (!Object.prototype.hasOwnProperty.call(compressedContent, block.id)) {
        return { ...block };
      }
      return {
        ...block,
        text: compressedContent[block.id],
      };
    }),
  };
  return validatePlatformPack({
    ...compressedPack,
    blocks: compressedPack.blocks.map((block) => {
      const currentLength = countUnicodeCharacters(block.text);
      return {
        ...block,
        currentLength,
        valid: block.maxLength === null || currentLength <= block.maxLength,
      };
    }),
  });
}

/**
 * 生成指定入口的猫箱输入包；只返回数据，不操作 UI、浏览器或持久化。
 *
 * @param {import("../../contracts.js").CharacterDraft} character
 * @param {string} flowId
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../../contracts.js").PlatformPack>}
 */
export async function generateMaoxiangPack(character, flowId, llmClient) {
  assertCharacterDraft(character);
  const flow = getEnabledFlow(flowId);
  const task = TASK_BY_FLOW[flowId];
  if (!task) {
    throw new Error(`猫箱入口 "${flowId}" 没有可用的生成任务。`);
  }
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }

  const fieldEntries = getFieldEntries(flow);
  const content = await requestMainContent(
    character,
    flowId,
    task,
    fieldEntries,
    llmClient,
  );
  const pack = validatePlatformPack({
    platform: "maoxiang",
    flowId,
    blocks: createBlocks(content, fieldEntries),
    generatedAt: new Date().toISOString(),
  });

  return compressOverLimitBlocks(pack, task, flow, llmClient);
}
