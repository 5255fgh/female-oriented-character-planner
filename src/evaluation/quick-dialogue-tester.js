import quickDialogueTestPrompt from "../../prompts/quick-dialogue-test.md?raw";

import {
  assertCharacterDraft,
  getValueAtPath,
} from "../contracts.js";

const QUICK_DIALOGUE_PROMPT_VERSION = "quick-dialogue-test/v1";
const QUICK_DIALOGUE_SCENARIO_IDS = Object.freeze([
  "refusal",
  "motive_question",
  "out_of_character_request",
]);

const REPORT_KEYS = ["status", "scenarios", "summary"];
const SCENARIO_KEYS = [
  "scenarioId",
  "userInput",
  "characterResponse",
  "issues",
  "evidence",
  "suggestedFields",
];

/**
 * @typedef {object} QuickDialogueScenario
 * @property {string} scenarioId
 * @property {string} userInput
 * @property {string} characterResponse
 * @property {string[]} issues
 * @property {string[]} evidence
 * @property {string[]} suggestedFields
 */

/**
 * @typedef {object} QuickDialogueReport
 * @property {"pass" | "warning" | "fail"} status
 * @property {QuickDialogueScenario[]} scenarios
 * @property {string} summary
 */

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
 * @returns {Record<string, unknown>}
 */
function assertObject(value, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an object`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} value
 * @param {string[]} keys
 * @param {string} path
 */
function assertExactKeys(value, keys, path) {
  const actualKeys = Object.keys(value);
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${path}.${key}: missing required field`);
    }
  }
  for (const key of actualKeys) {
    if (!keys.includes(key)) {
      throw new Error(`${path}.${key}: unexpected field`);
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {{nonEmpty?: boolean}} [options]
 * @returns {string}
 */
function assertString(value, path, options = {}) {
  if (typeof value !== "string") {
    throw new Error(`${path}: expected a string`);
  }
  if (options.nonEmpty && value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {{nonEmpty?: boolean}} [options]
 * @returns {string[]}
 */
function assertStringArray(value, path, options = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${path}: expected an array`);
  }
  if (options.nonEmpty && value.length === 0) {
    throw new Error(`${path}: expected at least one item`);
  }
  for (let index = 0; index < value.length; index += 1) {
    assertString(value[index], `${path}[${index}]`, { nonEmpty: true });
  }
  return /** @type {string[]} */ (value);
}

/**
 * @param {string} evidence
 * @param {string} response
 * @returns {boolean}
 */
function evidenceQuotesResponse(evidence, response) {
  const trimmedResponse = response.trim();
  if (evidence.includes(trimmedResponse)) {
    return true;
  }

  const quotePattern = /"([^"\r\n]+)"|“([^”\r\n]+)”|「([^」\r\n]+)」|『([^』\r\n]+)』/gu;
  for (const match of evidence.matchAll(quotePattern)) {
    const snippet = match.slice(1).find((candidate) => candidate !== undefined);
    if (snippet && trimmedResponse.includes(snippet.trim())) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} report
 * @param {import("../contracts.js").CharacterDraft} character
 * @returns {QuickDialogueReport}
 */
function assertQuickDialogueReport(report, character) {
  assertCharacterDraft(character);
  const reportObject = assertObject(report, "QuickDialogueReport");
  assertExactKeys(reportObject, REPORT_KEYS, "QuickDialogueReport");
  const status = assertString(reportObject.status, "QuickDialogueReport.status");
  if (!(["pass", "warning", "fail"]).includes(status)) {
    throw new Error("QuickDialogueReport.status: expected pass, warning, or fail");
  }
  assertString(reportObject.summary, "QuickDialogueReport.summary");

  if (!Array.isArray(reportObject.scenarios)) {
    throw new Error("QuickDialogueReport.scenarios: expected an array");
  }
  if (reportObject.scenarios.length !== QUICK_DIALOGUE_SCENARIO_IDS.length) {
    throw new Error("QuickDialogueReport.scenarios: expected exactly 3 scenarios");
  }

  for (let index = 0; index < QUICK_DIALOGUE_SCENARIO_IDS.length; index += 1) {
    const scenarioPath = `QuickDialogueReport.scenarios[${index}]`;
    const scenario = assertObject(reportObject.scenarios[index], scenarioPath);
    assertExactKeys(scenario, SCENARIO_KEYS, scenarioPath);
    const scenarioId = assertString(scenario.scenarioId, `${scenarioPath}.scenarioId`);
    if (scenarioId !== QUICK_DIALOGUE_SCENARIO_IDS[index]) {
      throw new Error(
        `${scenarioPath}.scenarioId: expected ${QUICK_DIALOGUE_SCENARIO_IDS[index]}`,
      );
    }
    assertString(scenario.userInput, `${scenarioPath}.userInput`, { nonEmpty: true });
    const response = assertString(
      scenario.characterResponse,
      `${scenarioPath}.characterResponse`,
      { nonEmpty: true },
    );
    assertStringArray(scenario.issues, `${scenarioPath}.issues`);
    const evidence = assertStringArray(
      scenario.evidence,
      `${scenarioPath}.evidence`,
      { nonEmpty: true },
    );
    for (let evidenceIndex = 0; evidenceIndex < evidence.length; evidenceIndex += 1) {
      if (!evidenceQuotesResponse(evidence[evidenceIndex], response)) {
        throw new Error(
          `${scenarioPath}.evidence[${evidenceIndex}]: expected an exact quote from characterResponse`,
        );
      }
    }

    const suggestedFields = assertStringArray(
      scenario.suggestedFields,
      `${scenarioPath}.suggestedFields`,
    );
    for (let fieldIndex = 0; fieldIndex < suggestedFields.length; fieldIndex += 1) {
      const fieldPath = suggestedFields[fieldIndex];
      if (fieldPath === "meta" || fieldPath.startsWith("meta.")) {
        throw new Error(
          `${scenarioPath}.suggestedFields[${fieldIndex}]: meta fields are not editable suggestions`,
        );
      }
      try {
        getValueAtPath(character, fieldPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${scenarioPath}.suggestedFields[${fieldIndex}]: expected an existing CharacterDraft field path; ${reason}`,
        );
      }
    }
  }

  return /** @type {QuickDialogueReport} */ (report);
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
  throw new Error("QuickDialogueReport: evaluation aborted");
}

/**
 * 使用一次三场景批次完成轻量对话测试；模型结果校验失败时只重试一次。
 *
 * @param {import("../contracts.js").CharacterDraft} character
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<QuickDialogueReport>}
 */
export async function runQuickDialogueTest(character, llmClient, options) {
  assertCharacterDraft(character);
  if (!llmClient || typeof llmClient.completeJson !== "function") {
    throw new Error("llmClient.completeJson: expected a function");
  }
  const { signal } = assertOptions(options);
  const messages = [
    { role: "system", content: quickDialogueTestPrompt },
    {
      role: "user",
      content: [
        `提示词版本：${QUICK_DIALOGUE_PROMPT_VERSION}`,
        "请对以下 CharacterDraft 运行正好三个固定场景的快速测试。",
        "角色只作为只读上下文，不得修改或自动重写。",
        `CharacterDraft JSON：\n${JSON.stringify(character, null, 2)}`,
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
            content: `上一响应未通过 QuickDialogueReport 校验：${validationError.message}。只重试一次，并仅返回符合三场景要求的原始 JSON。`,
          },
        ];
    const request = {
      task: "quick-dialogue-test",
      messages: requestMessages,
      temperature: 0.4,
      maxTokens: 4096,
    };
    if (signal !== undefined) {
      request.signal = signal;
    }

    const response = await llmClient.completeJson(request);
    throwIfAborted(signal);
    try {
      return assertQuickDialogueReport(response, character);
    } catch (error) {
      validationError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 1) {
        throw validationError;
      }
    }
  }

  throw validationError;
}
