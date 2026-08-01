import fieldRevisionPrompt from "../../prompts/field-regeneration.md?raw";

import {
  assertProjectDocument,
  getValueAtPath,
} from "../contracts.js";
import {
  assertJsonValue,
  cloneJsonValue,
} from "../contracts/common.js";
import { assertRevisionForProject } from "./revision-core.js";

const SYSTEM_MANAGED_PATHS = new Set([
  "meta",
  "meta.id",
  "meta.createdAt",
  "meta.updatedAt",
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
  throw new Error("revision: proposal aborted");
}

/**
 * 只抽取跨字段一致性所需的少量角色锚点，不传递完整项目或完整角色。
 *
 * @param {import("../contracts.js").CharacterDraft} character
 * @returns {Record<string, import("../contracts/common.js").JsonValue>}
 */
function createCharacterAnchors(character) {
  return {
    characterName: character.publicInfo.name,
    identity: character.persona.identity,
    currentGoal: character.persona.currentGoal,
    contradiction: character.persona.contradiction,
    initialRelation: character.relationship.initialRelation,
    forbiddenBehaviors: cloneJsonValue(character.persona.forbiddenBehaviors),
    bannedPhrases: cloneJsonValue(character.dialogueStyle.bannedPhrases),
  };
}

/**
 * 生成一个不自动应用的单字段修改提案；结构校验失败时只重试一次。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {string} fieldPath
 * @param {string} instruction
 * @param {import("../contracts/common.js").JsonValue | undefined} context
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<import("./revision-core.js").FieldRevision>}
 */
export async function proposeFieldRevision(
  project,
  fieldPath,
  instruction,
  context,
  llmClient,
  options,
) {
  assertProjectDocument(project);
  if (project.character === null) {
    throw new Error("project.character: expected a generated character");
  }
  if (typeof fieldPath !== "string" || fieldPath.trim().length === 0) {
    throw new Error("fieldPath: expected a non-empty string");
  }
  if (SYSTEM_MANAGED_PATHS.has(fieldPath)) {
    throw new Error(`fieldPath: ${fieldPath} is managed by the application`);
  }
  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    throw new Error("instruction: expected a non-empty string");
  }
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }
  if (context !== undefined) {
    assertJsonValue(context, "context");
  }
  const { signal } = assertOptions(options);
  const currentValue = getValueAtPath(project.character, fieldPath);
  assertJsonValue(currentValue, `CharacterDraft.${fieldPath}`);
  const anchors = createCharacterAnchors(project.character);
  const messages = [
    { role: "system", content: fieldRevisionPrompt },
    {
      role: "user",
      content: [
        "输出模式：revision-proposal",
        `唯一目标字段：${fieldPath}`,
        `当前字段值 JSON：\n${JSON.stringify(currentValue, null, 2)}`,
        `精简角色锚点 JSON：\n${JSON.stringify(anchors, null, 2)}`,
        `调用方相关上下文 JSON：\n${JSON.stringify(context ?? null, null, 2)}`,
        `定向修改要求：\n${instruction}`,
        "只返回 {\"fieldPath\",\"before\",\"after\",\"summary\"}，不得返回完整角色或项目。",
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
            content: `上一响应未通过单字段提案校验：${validationError.message}。只重试一次，并仅返回四字段原始 JSON。`,
          },
        ];
    const request = {
      task: "field-revision-proposal",
      messages: requestMessages,
      temperature: 0.4,
      maxTokens: 2048,
    };
    if (signal !== undefined) {
      request.signal = signal;
    }

    const response = await llmClient.completeJson(request);
    throwIfAborted(signal);
    try {
      const revision = assertRevisionForProject(project, response);
      if (revision.fieldPath !== fieldPath) {
        throw new Error(
          `revision.fieldPath: expected ${fieldPath}, received ${revision.fieldPath}`,
        );
      }
      return revision;
    } catch (error) {
      validationError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 1) {
        throw validationError;
      }
    }
  }

  throw validationError;
}
