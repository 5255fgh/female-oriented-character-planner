import prompt from "../../prompts/field-regeneration.md?raw";

import {
  assertCharacterDraft,
  assertFieldPatch,
  getValueAtPath,
} from "../contracts.js";

const FIELD_REGENERATION_PROMPT_VERSION = "field-regeneration/v1";

/**
 * @param {import("../contracts.js").CharacterDraft} character
 * @param {string} fieldPath
 * @param {string} instruction
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @returns {Promise<import("../contracts.js").FieldPatch>}
 */
export async function regenerateField(
  character,
  fieldPath,
  instruction,
  llmClient,
) {
  assertCharacterDraft(character);
  const currentValue = getValueAtPath(character, fieldPath);
  if (typeof instruction !== "string") {
    throw new Error("instruction: expected a string");
  }

  const messages = [
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: [
        `提示词版本：${FIELD_REGENERATION_PROMPT_VERSION}`,
        "以下完整角色仅作为只读上下文，绝对不能重写或返回完整角色。",
        `完整角色 JSON：\n${JSON.stringify(character, null, 2)}`,
        `唯一允许重写的字段路径：${fieldPath}`,
        `该字段当前值 JSON：\n${JSON.stringify(currentValue, null, 2)}`,
        `定向修改要求：\n${instruction}`,
        `只返回 {"fieldPath":${JSON.stringify(fieldPath)},"value":...}，不得包含其他字段。`,
      ].join("\n\n"),
    },
  ];

  const response = await llmClient.completeJson({
    task: "field-regeneration",
    messages,
  });
  const patch = assertFieldPatch(response);
  if (patch.fieldPath !== fieldPath) {
    throw new Error(
      `FieldPatch.fieldPath: expected "${fieldPath}", received "${patch.fieldPath}"`,
    );
  }
  return patch;
}
