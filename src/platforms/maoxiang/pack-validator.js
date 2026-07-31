import {
  assertPlatformPack,
  countUnicodeCharacters,
} from "../../contracts.js";
import { MAOXIANG_FLOWS } from "./config.js";

/**
 * @param {string} flowId
 * @param {string} blockId
 * @returns {{required: boolean, allowedValues?: readonly string[]}}
 */
function getBlockConfig(flowId, blockId) {
  const blockConfig = MAOXIANG_FLOWS[flowId]?.[blockId];
  if (!blockConfig || typeof blockConfig !== "object") {
    throw new Error(`MAOXIANG_FLOWS.${flowId}.${blockId}: missing block configuration`);
  }
  return blockConfig;
}

/**
 * 重新计算猫箱输入包的 Unicode 字符数和已知规则状态。
 *
 * @param {import("../../contracts.js").PlatformPack} pack
 * @returns {import("../../contracts.js").PlatformPack}
 */
export function validatePlatformPack(pack) {
  assertPlatformPack(pack);

  const validatedPack = {
    ...pack,
    blocks: pack.blocks.map((block) => {
      const blockConfig = getBlockConfig(pack.flowId, block.id);
      const currentLength = countUnicodeCharacters(block.text);
      const lengthValid =
        block.maxLength === null || currentLength <= block.maxLength;
      const requiredValid =
        block.maxLength !== null || !blockConfig.required || currentLength > 0;
      const enumValid =
        !blockConfig.allowedValues ||
        blockConfig.allowedValues.includes(block.text);

      return {
        ...block,
        currentLength,
        valid: lengthValid && requiredValid && enumValid,
      };
    }),
  };

  assertPlatformPack(validatedPack);
  return validatedPack;
}
