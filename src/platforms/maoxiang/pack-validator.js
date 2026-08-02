import {
  assertPlatformPack,
  countUnicodeCharacters,
} from "../../contracts.js";
import {
  getMaoxiangRules,
  MAOXIANG_FIELD_LABELS,
} from "./rules.js";

const BLOCK_KEYS = new Set([
  "id",
  "label",
  "text",
  "maxLength",
  "currentLength",
  "valid",
  "verified",
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
 * @param {string} flowId
 * @param {unknown} fieldValues
 * @returns {Record<string, string>}
 */
function assertFieldValues(flowId, fieldValues) {
  if (!isPlainObject(fieldValues)) {
    throw new Error(`MaoxiangFields.${flowId}: expected an object`);
  }
  const rules = getMaoxiangRules(flowId);
  const expectedIds = Object.keys(rules);
  const expected = new Set(expectedIds);

  for (const fieldId of Object.keys(fieldValues)) {
    if (!expected.has(fieldId)) {
      throw new Error(`MaoxiangFields.${flowId}.${fieldId}: unexpected field`);
    }
  }
  for (const fieldId of expectedIds) {
    if (!Object.prototype.hasOwnProperty.call(fieldValues, fieldId)) {
      throw new Error(`MaoxiangFields.${flowId}.${fieldId}: missing field`);
    }
    if (typeof fieldValues[fieldId] !== "string") {
      throw new Error(`MaoxiangFields.${flowId}.${fieldId}: expected a string`);
    }
  }
  return /** @type {Record<string, string>} */ (fieldValues);
}

/**
 * 统一校验猫箱字段，并生成 PlatformBlock 元数据。
 * 未确认上限保持 null，不参与长度失败判定。
 *
 * @param {string} flowId
 * @param {Record<string, string>} fieldValues
 * @returns {import("../../contracts.js").PlatformBlock[]}
 */
export function validateMaoxiangFields(flowId, fieldValues) {
  const values = assertFieldValues(flowId, fieldValues);
  const rules = getMaoxiangRules(flowId);
  return Object.entries(rules).map(([fieldId, rule]) => {
    const text = values[fieldId];
    const currentLength = countUnicodeCharacters(text);
    const requiredValid = !rule.required || text.trim().length > 0;
    const lengthValid =
      rule.maxLength === null || currentLength <= rule.maxLength;
    const enumValid =
      rule.allowedValues === null || rule.allowedValues.includes(text);

    return {
      id: fieldId,
      label: MAOXIANG_FIELD_LABELS[flowId][fieldId],
      text,
      maxLength: rule.maxLength,
      currentLength,
      valid: requiredValid && lengthValid && enumValid,
      verified: rule.verified,
    };
  });
}

/**
 * @param {unknown} pack
 * @returns {{platform: "maoxiang", flowId: string, blocks: unknown[], generatedAt: string}}
 */
function assertPackShell(pack) {
  if (!isPlainObject(pack)) {
    throw new Error("PlatformPack: expected an object");
  }
  const expectedKeys = new Set(["platform", "flowId", "blocks", "generatedAt"]);
  for (const key of Object.keys(pack)) {
    if (!expectedKeys.has(key)) {
      throw new Error(`PlatformPack.${key}: unexpected field`);
    }
  }
  if (pack.platform !== "maoxiang") {
    throw new Error('PlatformPack.platform: expected "maoxiang"');
  }
  if (typeof pack.flowId !== "string") {
    throw new Error("PlatformPack.flowId: expected a string");
  }
  getMaoxiangRules(pack.flowId);
  if (!Array.isArray(pack.blocks)) {
    throw new Error("PlatformPack.blocks: expected an array");
  }
  if (typeof pack.generatedAt !== "string") {
    throw new Error("PlatformPack.generatedAt: expected a string");
  }
  return /** @type {{platform: "maoxiang", flowId: string, blocks: unknown[], generatedAt: string}} */ (pack);
}

/**
 * @param {unknown[]} blocks
 * @param {string} flowId
 * @returns {Record<string, string>}
 */
function extractBlockValues(blocks, flowId) {
  const values = {};
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const blockPath = `PlatformPack.blocks[${index}]`;
    if (!isPlainObject(block)) {
      throw new Error(`${blockPath}: expected an object`);
    }
    for (const key of Object.keys(block)) {
      if (!BLOCK_KEYS.has(key)) {
        throw new Error(`${blockPath}.${key}: unexpected field`);
      }
    }
    if (typeof block.id !== "string") {
      throw new Error(`${blockPath}.id: expected a string`);
    }
    if (typeof block.text !== "string") {
      throw new Error(`${blockPath}.text: expected a string`);
    }
    if (Object.prototype.hasOwnProperty.call(values, block.id)) {
      throw new Error(`${blockPath}.id: duplicate field "${block.id}"`);
    }
    values[block.id] = block.text;
  }
  return assertFieldValues(flowId, values);
}

/**
 * 重新计算猫箱输入包的 Unicode 字符数和全部声明式规则状态。
 *
 * @param {import("../../contracts.js").PlatformPack | Record<string, unknown>} pack
 * @returns {import("../../contracts.js").PlatformPack}
 */
export function validatePlatformPack(pack) {
  const shell = assertPackShell(pack);
  const fieldValues = extractBlockValues(shell.blocks, shell.flowId);
  const validatedPack = {
    platform: "maoxiang",
    flowId: shell.flowId,
    blocks: validateMaoxiangFields(shell.flowId, fieldValues),
    generatedAt: shell.generatedAt,
  };

  return assertPlatformPack(validatedPack);
}
