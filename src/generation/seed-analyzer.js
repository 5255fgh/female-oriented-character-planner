import prompt from "../../prompts/seed-analysis.md?raw";

import { assertCreativeSeed } from "../contracts.js";

const SEED_ANALYSIS_PROMPT_VERSION = "seed-analysis/v1";
const LOW_IMPACT_DETAIL_PATTERN =
  /生日|出生日期|星座|血型|发色|瞳色|身高|体重|惯用手|幸运数字|喜欢的颜色/u;

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
 * @returns {string}
 */
function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {{questions: Array<{id: string, prompt: string, options: string[], recommended: string}>}}
 */
function assertSeedAnalysis(value) {
  if (!isPlainObject(value)) {
    throw new Error("SeedAnalysis: expected an object");
  }
  for (const key of Object.keys(value)) {
    if (key !== "questions") {
      throw new Error(`SeedAnalysis.${key}: unexpected field`);
    }
  }
  if (!Array.isArray(value.questions)) {
    throw new Error("SeedAnalysis.questions: expected an array");
  }
  if (value.questions.length > 3) {
    throw new Error("SeedAnalysis.questions: expected at most 3 questions");
  }

  const ids = new Set();
  const questions = value.questions.map((questionValue, index) => {
    const path = `SeedAnalysis.questions[${index}]`;
    if (!isPlainObject(questionValue)) {
      throw new Error(`${path}: expected an object`);
    }
    const expectedKeys = new Set(["id", "prompt", "options", "recommended"]);
    for (const key of Object.keys(questionValue)) {
      if (!expectedKeys.has(key)) {
        throw new Error(`${path}.${key}: unexpected field`);
      }
    }

    const id = assertNonEmptyString(questionValue.id, `${path}.id`);
    const questionPrompt = assertNonEmptyString(
      questionValue.prompt,
      `${path}.prompt`,
    );
    if (ids.has(id)) {
      throw new Error(`${path}.id: expected a unique question id`);
    }
    ids.add(id);
    if (LOW_IMPACT_DETAIL_PATTERN.test(questionPrompt)) {
      throw new Error(`${path}.prompt: asks for a low-impact reversible detail`);
    }

    if (!Array.isArray(questionValue.options)) {
      throw new Error(`${path}.options: expected an array`);
    }
    if (questionValue.options.length < 3 || questionValue.options.length > 5) {
      throw new Error(`${path}.options: expected 3 to 5 options`);
    }
    const questionOptions = questionValue.options.map((option, optionIndex) =>
      assertNonEmptyString(option, `${path}.options[${optionIndex}]`),
    );
    if (new Set(questionOptions).size !== questionOptions.length) {
      throw new Error(`${path}.options: expected unique options`);
    }

    const recommended = assertNonEmptyString(
      questionValue.recommended,
      `${path}.recommended`,
    );
    if (!questionOptions.includes(recommended)) {
      throw new Error(`${path}.recommended: expected a value from options`);
    }

    return { id, prompt: questionPrompt, options: questionOptions, recommended };
  });

  return { questions };
}

/**
 * @param {import("../contracts.js").CreativeSeed} seed
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{questions: Array<{id: string, prompt: string, options: string[], recommended: string}>}>}
 */
export async function analyzeCreativeSeed(seed, llmClient, options = {}) {
  assertCreativeSeed(seed);

  const response = await llmClient.completeJson({
    task: "seed-analysis",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          `提示词版本：${SEED_ANALYSIS_PROMPT_VERSION}`,
          `创作种子：${JSON.stringify(seed.text)}`,
        ].join("\n\n"),
      },
    ],
    temperature: 0.2,
    maxTokens: 2048,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  return assertSeedAnalysis(response);
}
