import {
  assertArray,
  assertBoolean,
  assertEnum,
  assertExactKeys,
  assertNumber,
  assertObject,
  assertString,
  fail,
} from "./common.js";

/**
 * @typedef {object} PlatformBlock
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {number | null} maxLength
 * @property {number} currentLength
 * @property {boolean} valid
 * @property {boolean} verified
 */

/**
 * @typedef {object} PlatformPack
 * @property {"maoxiang"} platform
 * @property {string} flowId
 * @property {PlatformBlock[]} blocks
 * @property {string} generatedAt
 */

const PLATFORM_FLOW_IDS = ["free_character", "dead_rival", "image_shape", "open_story"];

/** @param {unknown} value @param {string} path */
export function validatePlatformPack(value, path) {
  const pack = assertObject(value, path);
  assertExactKeys(pack, ["platform", "flowId", "blocks", "generatedAt"], path);
  assertEnum(pack.platform, ["maoxiang"], `${path}.platform`);
  assertEnum(pack.flowId, PLATFORM_FLOW_IDS, `${path}.flowId`);
  const blocks = assertArray(pack.blocks, `${path}.blocks`);
  const blockIds = new Set();
  blocks.forEach((value, index) => {
    const blockPath = `${path}.blocks[${index}]`;
    const block = assertObject(value, blockPath);
    assertExactKeys(block, ["id", "label", "text", "maxLength", "currentLength", "valid", "verified"], blockPath);
    const id = assertString(block.id, `${blockPath}.id`);
    assertString(block.label, `${blockPath}.label`);
    const text = assertString(block.text, `${blockPath}.text`);
    if (block.maxLength !== null) {
      const maxLength = assertNumber(block.maxLength, `${blockPath}.maxLength`);
      if (maxLength < 0) fail(`${blockPath}.maxLength`, "expected a non-negative number or null");
    }
    const currentLength = assertNumber(block.currentLength, `${blockPath}.currentLength`);
    if (currentLength < 0) fail(`${blockPath}.currentLength`, "expected a non-negative number");
    const measuredLength = Array.from(text).length;
    if (currentLength !== measuredLength) fail(`${blockPath}.currentLength`, `expected ${measuredLength} to match the Unicode character count of ${blockPath}.text`);
    assertBoolean(block.valid, `${blockPath}.valid`);
    assertBoolean(block.verified, `${blockPath}.verified`);
    if (typeof block.maxLength === "number" && currentLength > block.maxLength && block.valid) {
      fail(`${blockPath}.valid`, "expected false when currentLength exceeds maxLength");
    }
    if (blockIds.has(id)) fail(`${blockPath}.id`, "expected a unique block id");
    blockIds.add(id);
  });
  assertString(pack.generatedAt, `${path}.generatedAt`);
}

/** @param {unknown} value @returns {PlatformPack} */
export function assertPlatformPack(value) {
  validatePlatformPack(value, "PlatformPack");
  return /** @type {PlatformPack} */ (value);
}
