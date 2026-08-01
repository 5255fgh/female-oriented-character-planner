const JSON_RESPONSE_FORMAT = { type: "json_object" };
const JSON_RETRY_MESSAGE =
  "只返回一个合法 JSON 值，不要使用 Markdown 代码围栏，不要添加解释文字。";
const MAX_ERROR_SUMMARY_LENGTH = 500;
const ALLOWED_TEXT_PART_TYPES = new Set(["text", "output_text"]);
const INCOMPLETE_FINISH_REASONS = new Set([
  "length",
  "tool_calls",
  "function_call",
  "content_filter",
]);
const INTERNAL_CONTENT_TYPE_PATTERN = /reasoning|analysis|thought/i;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 对可能来自上游的错误文本做最小脱敏，避免错误信息回显凭据。
 *
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeErrorText(value) {
  return String(value ?? "")
    .replace(
      /(\b(?:llm[_ -]?)?api[_ -]?key\b["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /(\bauthorization\b["']?\s*[:=]\s*["']?)(?:bearer\s+)?[^"'\s,}]+/gi,
      "$1[REDACTED]",
    )
    .replace(/\bbearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
function summarizeErrorField(value, maxLength) {
  if (!["string", "number", "boolean"].includes(typeof value)) {
    return "";
  }
  return sanitizeErrorText(value).slice(0, maxLength);
}

/**
 * @param {unknown} payload
 * @param {string} rawText
 * @param {string} statusText
 * @returns {string}
 */
function summarizeUpstreamError(payload, rawText, statusText) {
  let message = "";
  let type = "";
  let code = "";

  if (isRecord(payload)) {
    if (isRecord(payload.error)) {
      message = summarizeErrorField(payload.error.message, MAX_ERROR_SUMMARY_LENGTH);
      type = summarizeErrorField(payload.error.type, 100);
      code = summarizeErrorField(payload.error.code, 100);
    } else if (typeof payload.error === "string") {
      message = summarizeErrorField(payload.error, MAX_ERROR_SUMMARY_LENGTH);
    }

    if (!message && typeof payload.message === "string") {
      message = summarizeErrorField(payload.message, MAX_ERROR_SUMMARY_LENGTH);
    }
  }

  if (!message && !type && !code) {
    message = summarizeErrorField(
      rawText || statusText || "upstream request failed",
      MAX_ERROR_SUMMARY_LENGTH,
    );
  }

  const metadata = [
    type ? `type=${type}` : "",
    code ? `code=${code}` : "",
  ].filter(Boolean).join("; ");
  const messageLength = Math.max(
    0,
    MAX_ERROR_SUMMARY_LENGTH - (metadata ? metadata.length + 2 : 0),
  );
  const summary = [message.slice(0, messageLength), metadata]
    .filter(Boolean)
    .join("; ")
    .slice(0, MAX_ERROR_SUMMARY_LENGTH);
  return summary || "upstream request failed";
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown> | null}
 */
function findUpstreamErrorPayload(payload) {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const errorPayload = findUpstreamErrorPayload(item);
      if (errorPayload) {
        return errorPayload;
      }
    }
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "error") &&
    payload.error !== null &&
    payload.error !== undefined
  ) {
    return payload;
  }
  if (isRecord(payload.response)) {
    return findUpstreamErrorPayload(payload.response);
  }
  return null;
}

/**
 * @param {string} rawText
 * @returns {{events: unknown[], parseError: unknown}}
 */
function parseSseEvents(rawText) {
  const events = [];
  let dataLines = [];
  let sawDataLine = false;
  let parseError = null;

  function flushEvent() {
    if (dataLines.length === 0 || parseError) {
      dataLines = [];
      return;
    }

    const data = dataLines.join("\n").trim();
    dataLines = [];
    if (!data || data === "[DONE]") {
      return;
    }

    try {
      events.push(JSON.parse(data));
    } catch (error) {
      parseError = error;
    }
  }

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (line.length === 0) {
      flushEvent();
      continue;
    }
    if (line.startsWith("data:")) {
      sawDataLine = true;
      dataLines.push(line.slice(5).trimStart());
    }
  }
  flushEvent();

  if (!sawDataLine) {
    return {
      events: [],
      parseError: new Error("SSE response did not contain data events"),
    };
  }
  return { events, parseError };
}

/**
 * @param {Response} response
 * @returns {string}
 */
function getResponseContentType(response) {
  try {
    return response.headers?.get?.("content-type") || "";
  } catch {
    return "";
  }
}

/**
 * @param {Response} response
 * @returns {Promise<{
 *   payload: unknown,
 *   rawText: string,
 *   parseError: unknown,
 *   contentType: string,
 *   isSse: boolean
 * }>}
 */
async function readResponseBody(response) {
  const contentType = getResponseContentType(response);
  if (typeof response.text === "function") {
    try {
      const rawText = await response.text();
      try {
        return {
          payload: rawText.length > 0 ? JSON.parse(rawText) : null,
          rawText,
          parseError: null,
          contentType,
          isSse: false,
        };
      } catch (jsonError) {
        const looksLikeSse =
          /text\/event-stream/i.test(contentType) ||
          /^\s*(?:event|data):/m.test(rawText);
        if (looksLikeSse) {
          const parsed = parseSseEvents(rawText);
          return {
            payload: parsed.events,
            rawText,
            parseError: parsed.parseError,
            contentType,
            isSse: true,
          };
        }
        return {
          payload: null,
          rawText,
          parseError: jsonError,
          contentType,
          isSse: false,
        };
      }
    } catch (error) {
      return {
        payload: null,
        rawText: "",
        parseError: error,
        contentType,
        isSse: false,
      };
    }
  }

  try {
    return {
      payload: await response.json(),
      rawText: "",
      parseError: null,
      contentType,
      isSse: false,
    };
  } catch (error) {
    return {
      payload: null,
      rawText: "",
      parseError: error,
      contentType,
      isSse: false,
    };
  }
}

/**
 * 只拼接明确属于最终正文的文本项，忽略 reasoning/analysis 等内部内容。
 *
 * @param {unknown} rawContent
 * @returns {string}
 */
function messageContentToText(rawContent) {
  if (rawContent === null || rawContent === undefined) {
    return "";
  }
  if (typeof rawContent === "string") {
    return rawContent;
  }
  if (!Array.isArray(rawContent)) {
    return "";
  }

  return rawContent.map((part) => {
    if (typeof part === "string") {
      return part;
    }
    if (!isRecord(part) || typeof part.text !== "string") {
      return "";
    }
    if (part.type === undefined || part.type === null) {
      return part.text;
    }
    return (
      typeof part.type === "string" &&
      ALLOWED_TEXT_PART_TYPES.has(part.type.toLowerCase())
    )
      ? part.text
      : "";
  }).join("");
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isInternalContentContainer(value) {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    INTERNAL_CONTENT_TYPE_PATTERN.test(value.type)
  );
}

/**
 * @typedef {{
 *   path: string,
 *   family: string,
 *   text: string,
 *   kind: "final" | "delta"
 * }} TextCandidate
 */

/**
 * @param {unknown} payload
 * @param {string} [prefix]
 * @returns {TextCandidate[]}
 */
function collectTextCandidates(payload, prefix = "") {
  if (!isRecord(payload)) {
    return [];
  }

  /** @type {TextCandidate[]} */
  const candidates = [];
  const path = (value) => `${prefix}${value}`;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] : null;

  if (
    choice &&
    isRecord(choice.message) &&
    !isInternalContentContainer(choice.message) &&
    Object.hasOwn(choice.message, "content")
  ) {
    candidates.push({
      path: path("choices[0].message.content"),
      family: "message.content",
      text: messageContentToText(choice.message.content),
      kind: "final",
    });
  }
  if (choice && Object.hasOwn(choice, "text")) {
    candidates.push({
      path: path("choices[0].text"),
      family: "choice.text",
      text: messageContentToText(choice.text),
      kind: "final",
    });
  }
  if (Object.hasOwn(payload, "output_text")) {
    candidates.push({
      path: path("output_text"),
      family: "output_text",
      text: messageContentToText(payload.output_text),
      kind: "final",
    });
  }

  if (Array.isArray(payload.output)) {
    const outputTextParts = [];
    let sawEligibleTextPart = false;
    for (const outputItem of payload.output) {
      if (
        !isRecord(outputItem) ||
        isInternalContentContainer(outputItem) ||
        !Array.isArray(outputItem.content)
      ) {
        continue;
      }
      for (const contentPart of outputItem.content) {
        if (!isRecord(contentPart) || !Object.hasOwn(contentPart, "text")) {
          continue;
        }
        const text = messageContentToText([contentPart]);
        const typeAllowed =
          contentPart.type === undefined ||
          contentPart.type === null ||
          (
            typeof contentPart.type === "string" &&
            ALLOWED_TEXT_PART_TYPES.has(contentPart.type.toLowerCase())
          );
        if (typeAllowed) {
          sawEligibleTextPart = true;
          outputTextParts.push(text);
        }
      }
    }
    if (sawEligibleTextPart) {
      candidates.push({
        path: path("output[*].content[*].text"),
        family: "output.content.text",
        text: outputTextParts.join(""),
        kind: "final",
      });
    }
  }

  if (isRecord(payload.response)) {
    candidates.push(...collectTextCandidates(payload.response, path("response.")));
  }

  if (
    choice &&
    isRecord(choice.delta) &&
    !isInternalContentContainer(choice.delta) &&
    Object.hasOwn(choice.delta, "content")
  ) {
    candidates.push({
      path: path("choices[0].delta.content"),
      family: "choice.delta.content",
      text: messageContentToText(choice.delta.content),
      kind: "delta",
    });
  }
  if (
    isRecord(payload.delta) &&
    !isInternalContentContainer(payload) &&
    !isInternalContentContainer(payload.delta) &&
    Object.hasOwn(payload.delta, "content")
  ) {
    candidates.push({
      path: path("delta.content"),
      family: "delta.content",
      text: messageContentToText(payload.delta.content),
      kind: "delta",
    });
  }
  if (
    typeof payload.type === "string" &&
    ["response.output_text.delta", "output_text.delta"].includes(payload.type) &&
    typeof payload.delta === "string"
  ) {
    candidates.push({
      path: path("output_text.delta"),
      family: "output_text.delta",
      text: payload.delta,
      kind: "delta",
    });
  }

  return candidates;
}

/**
 * @param {unknown} payload
 * @param {boolean} isSse
 * @returns {{
 *   text: string,
 *   selectedPath: string,
 *   presentPaths: string[],
 *   nonEmptyPaths: string[]
 * }}
 */
function extractResponseText(payload, isSse) {
  const records = Array.isArray(payload) ? payload : [payload];
  const candidatesByRecord = records.map((record) => collectTextCandidates(record));
  const allCandidates = candidatesByRecord.flat();
  const presentPaths = [...new Set(allCandidates.map((candidate) => candidate.path))];
  const nonEmptyPaths = [...new Set(
    allCandidates
      .filter((candidate) => candidate.text.trim().length > 0)
      .map((candidate) => candidate.path),
  )];

  if (isSse || records.length > 1) {
    const deltaFamily = [
      "choice.delta.content",
      "output_text.delta",
      "delta.content",
    ].find((family) => allCandidates.some(
      (candidate) =>
        candidate.kind === "delta" &&
        candidate.family === family &&
        candidate.text.trim().length > 0,
    ));
    const deltas = deltaFamily
      ? allCandidates.filter(
        (candidate) =>
          candidate.kind === "delta" &&
          candidate.family === deltaFamily &&
          candidate.text.length > 0,
      )
      : [];
    if (deltas.length > 0) {
      return {
        text: deltas.map((candidate) => candidate.text).join(""),
        selectedPath: [...new Set(deltas.map((candidate) => candidate.path))].join(" + "),
        presentPaths,
        nonEmptyPaths,
      };
    }

    for (let index = candidatesByRecord.length - 1; index >= 0; index -= 1) {
      const candidate = candidatesByRecord[index].find(
        (item) => item.kind === "final" && item.text.trim().length > 0,
      );
      if (candidate) {
        return {
          text: candidate.text,
          selectedPath: candidate.path,
          presentPaths,
          nonEmptyPaths,
        };
      }
    }
  } else {
    const candidate = allCandidates.find((item) => item.text.trim().length > 0);
    if (candidate) {
      return {
        text: candidate.text,
        selectedPath: candidate.path,
        presentPaths,
        nonEmptyPaths,
      };
    }
  }

  return { text: "", selectedPath: "", presentPaths, nonEmptyPaths };
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown>[]}
 */
function getResponseRecords(payload) {
  const roots = Array.isArray(payload) ? payload : [payload];
  const records = [];
  for (const root of roots) {
    if (!isRecord(root)) {
      continue;
    }
    records.push(root);
    if (isRecord(root.response)) {
      records.push(root.response);
    }
  }
  return records;
}

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {boolean}
 */
function containsReasoningField(value, depth = 0) {
  if (depth > 5 || value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsReasoningField(item, depth + 1));
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      INTERNAL_CONTENT_TYPE_PATTERN.test(key) &&
      !/(?:^|_)tokens?(?:_|$)/i.test(key)
    ) {
      return true;
    }
    if (
      key === "type" &&
      typeof child === "string" &&
      /reasoning|analysis|thought/i.test(child)
    ) {
      return true;
    }
    if (containsReasoningField(child, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} payload
 * @param {boolean} isSse
 * @returns {string}
 */
function summarizeResponseStructure(payload, isSse) {
  const records = getResponseRecords(payload);
  const topFields = new Set();
  const choiceFields = new Set();
  const messageFields = new Set();
  const deltaFields = new Set();
  let outputCount = 0;

  for (const record of records) {
    for (const key of Object.keys(record)) {
      topFields.add(key);
    }
    if (Array.isArray(record.output)) {
      outputCount = Math.max(outputCount, record.output.length);
    }
    if (!Array.isArray(record.choices)) {
      continue;
    }
    for (const choice of record.choices) {
      if (!isRecord(choice)) {
        continue;
      }
      for (const key of Object.keys(choice)) {
        choiceFields.add(key);
      }
      if (isRecord(choice.message)) {
        for (const key of Object.keys(choice.message)) {
          messageFields.add(key);
        }
      }
      if (isRecord(choice.delta)) {
        for (const key of Object.keys(choice.delta)) {
          deltaFields.add(key);
        }
      }
    }
  }

  return sanitizeErrorText([
    `transport=${isSse ? "sse" : "json"}`,
    `top=[${[...topFields].join(",")}]`,
    `choice=[${[...choiceFields].join(",")}]`,
    `message=[${[...messageFields].join(",")}]`,
    `delta=[${[...deltaFields].join(",")}]`,
    `output_count=${outputCount}`,
    `events=${Array.isArray(payload) ? payload.length : 0}`,
  ].join(", ")).slice(0, 100);
}

/**
 * @param {unknown} value
 * @param {string} [key]
 * @param {number} [depth]
 * @returns {unknown}
 */
function sanitizeDiagnosticValue(value, key = "", depth = 0) {
  if (
    INTERNAL_CONTENT_TYPE_PATTERN.test(key) &&
    typeof value !== "number" &&
    !/(?:^|_)tokens?(?:_|$)/i.test(key)
  ) {
    return "[IGNORED]";
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeErrorText(value).slice(0, 30);
  }
  if (depth >= 3) {
    return Array.isArray(value) ? `array(${value.length})` : typeof value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => sanitizeDiagnosticValue(item, key, depth + 1));
  }
  if (!isRecord(value)) {
    return typeof value;
  }

  const result = {};
  for (const [childKey, childValue] of Object.entries(value).slice(0, 12)) {
    result[childKey] = sanitizeDiagnosticValue(childValue, childKey, depth + 1);
  }
  return result;
}

/**
 * @param {unknown} payload
 * @param {string} requestedModel
 * @param {string} contentType
 * @param {boolean} isSse
 * @param {{selectedPath: string, presentPaths: string[], nonEmptyPaths: string[]}} extraction
 * @returns {{
 *   model: string,
 *   finishReason: string,
 *   choicesCount: number,
 *   usage: unknown,
 *   contentType: string,
 *   structure: string,
 *   selectedPath: string,
 *   presentPaths: string[],
 *   nonEmptyPaths: string[],
 *   reasoningFieldsIgnored: boolean
 * }}
 */
function buildResponseDiagnostics(
  payload,
  requestedModel,
  contentType,
  isSse,
  extraction,
) {
  const records = getResponseRecords(payload);
  let responseModel = "";
  let finishReason = "";
  let choicesCount = 0;
  let usage = null;

  for (const record of records) {
    if (typeof record.model === "string") {
      responseModel = record.model;
    }
    if (record.usage !== undefined && record.usage !== null) {
      usage = record.usage;
    }
    if (!Array.isArray(record.choices)) {
      continue;
    }
    choicesCount = Math.max(choicesCount, record.choices.length);
    for (const choice of record.choices) {
      if (
        isRecord(choice) &&
        choice.finish_reason !== null &&
        choice.finish_reason !== undefined
      ) {
        finishReason = summarizeErrorField(choice.finish_reason, 80);
      }
    }
  }

  return {
    model: summarizeErrorField(responseModel || requestedModel, 120) || "unknown",
    finishReason: finishReason || "null",
    choicesCount,
    usage,
    contentType: summarizeErrorField(contentType || "unknown", 100) || "unknown",
    structure: summarizeResponseStructure(payload, isSse),
    selectedPath: extraction.selectedPath,
    presentPaths: extraction.presentPaths,
    nonEmptyPaths: extraction.nonEmptyPaths,
    reasoningFieldsIgnored: containsReasoningField(payload),
  };
}

/**
 * @param {ReturnType<typeof buildResponseDiagnostics>} diagnostics
 * @returns {string}
 */
function formatResponseDiagnostics(diagnostics) {
  let usage = "null";
  try {
    usage = sanitizeErrorText(JSON.stringify(
      sanitizeDiagnosticValue(diagnostics.usage ?? null),
    )).slice(0, 50);
  } catch {
    usage = "unavailable";
  }
  const presentPaths = diagnostics.presentPaths.length > 0
    ? diagnostics.presentPaths.join(",").slice(0, 40)
    : "none";
  const nonEmptyPaths = diagnostics.nonEmptyPaths.length > 0
    ? diagnostics.nonEmptyPaths.join(",").slice(0, 20)
    : "none";

  return sanitizeErrorText([
    `model=${diagnostics.model.slice(0, 30)}`,
    `finish_reason=${diagnostics.finishReason.slice(0, 20)}`,
    `choices=${diagnostics.choicesCount}`,
    `usage=${usage}`,
    `structure=${diagnostics.structure.slice(0, 55)}`,
    `possible_body_paths=${presentPaths}`,
    `nonempty_body_paths=${nonEmptyPaths}`,
    `reasoning_fields_ignored=${diagnostics.reasoningFieldsIgnored}`,
  ].join("; "));
}

/**
 * @param {unknown} cause
 * @param {ReturnType<typeof buildResponseDiagnostics>} diagnostics
 * @returns {Error}
 */
function createResponseContentError(cause, diagnostics) {
  const causeMessage = cause instanceof Error
    ? sanitizeErrorText(cause.message).slice(0, 70)
    : "LLM response content could not be used";
  const hint = diagnostics.finishReason === "length"
    ? "; hint=increase maxTokens or use a compatible non-reasoning model"
    : "";
  const errorSummary = sanitizeErrorText(
    `${causeMessage}${hint}; ${formatResponseDiagnostics(diagnostics)}`,
  );
  return new Error(errorSummary);
}

/**
 * @param {ReturnType<typeof buildResponseDiagnostics>} diagnostics
 * @returns {boolean}
 */
function hasIncompleteFinishReason(diagnostics) {
  return INCOMPLETE_FINISH_REASONS.has(diagnostics.finishReason);
}

/**
 * 从指定起点扫描一个完整的对象或数组，字符串中的括号不参与平衡计算。
 *
 * @param {string} text
 * @param {number} startIndex
 * @returns {number}
 */
function findBalancedJsonEnd(text, startIndex) {
  const expectedClosers = [];
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      expectedClosers.push("}");
      continue;
    }
    if (character === "[") {
      expectedClosers.push("]");
      continue;
    }
    if (character === "}" || character === "]") {
      if (expectedClosers.pop() !== character) {
        return -1;
      }
      if (expectedClosers.length === 0) {
        return index;
      }
    }
  }

  return -1;
}

/**
 * 从模型内容中提取第一个可解析的 JSON 值。先尝试整段解析，再逐字符
 * 扫描平衡的对象或数组，以兼容代码围栏和 JSON 前后的说明文字。
 *
 * @param {unknown} rawContent
 * @returns {unknown}
 */
function extractJsonValue(rawContent) {
  const text = messageContentToText(rawContent).replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("LLM response content was empty");
  }

  try {
    return JSON.parse(text);
  } catch {
    // 继续扫描包裹在 Markdown 或说明文字中的对象与数组。
  }

  for (let startIndex = 0; startIndex < text.length; startIndex += 1) {
    if (text[startIndex] !== "{" && text[startIndex] !== "[") {
      continue;
    }

    const endIndex = findBalancedJsonEnd(text, startIndex);
    if (endIndex === -1) {
      continue;
    }

    try {
      return JSON.parse(text.slice(startIndex, endIndex + 1));
    } catch {
      // 当前平衡片段并非合法 JSON，继续寻找后续候选。
    }
  }

  throw new Error("LLM response content did not contain a valid JSON value");
}

/**
 * 创建通过本地代理调用 OpenAI Chat Completions 兼容接口的客户端。
 *
 * @param {{endpoint?: string, model?: string}} [options]
 * @returns {{
 *   completeJson(request: {
 *     task: string,
 *     messages: unknown[],
 *     temperature?: number,
 *     maxTokens?: number,
 *     signal?: AbortSignal
 *   }): Promise<object>,
 *   completeText(request: {
 *     task: string,
 *     messages: unknown[],
 *     temperature?: number,
 *     maxTokens?: number,
 *     signal?: AbortSignal
 *   }): Promise<string>
 * }}
 */
export function createLLMClient({
  endpoint = "/api/llm/chat/completions",
  model = import.meta.env?.VITE_LLM_MODEL || "deepseek-v4-flash",
} = {}) {
  /**
   * @param {{
   *   messages: unknown[],
   *   temperature: number,
   *   maxTokens: number,
   *   jsonResponse: boolean,
   *   signal?: AbortSignal
   * }} request
   * @returns {Promise<{
   *   content: string,
   *   diagnostics: ReturnType<typeof buildResponseDiagnostics>
   * }>}
   */
  async function requestCompletion({
    messages,
    temperature,
    maxTokens,
    jsonResponse,
    signal,
  }) {
    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    if (jsonResponse) {
      requestBody.response_format = JSON_RESPONSE_FORMAT;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      ...(signal === undefined ? {} : { signal }),
    });
    const {
      payload,
      rawText,
      parseError,
      contentType,
      isSse,
    } = await readResponseBody(response);
    const upstreamErrorPayload = findUpstreamErrorPayload(payload);

    if (!response.ok || upstreamErrorPayload) {
      const summary = summarizeUpstreamError(
        upstreamErrorPayload || payload,
        rawText,
        response.statusText,
      );
      const errorKind = response.ok
        ? "LLM upstream returned an error"
        : "LLM request failed";
      throw new Error(`${errorKind} with status ${response.status}: ${summary}`);
    }

    if (parseError) {
      throw new Error(
        `LLM upstream response was neither valid JSON nor valid SSE: content_type=${
          summarizeErrorField(contentType || "unknown", 100) || "unknown"
        }`,
      );
    }
    if (payload !== null && typeof payload !== "object") {
      throw new Error("LLM upstream response was not a JSON object, array, or SSE sequence");
    }

    const usablePayload = payload ?? {};
    const extraction = extractResponseText(usablePayload, isSse);
    return {
      content: extraction.text,
      diagnostics: buildResponseDiagnostics(
        usablePayload,
        model,
        contentType,
        isSse,
        extraction,
      ),
    };
  }

  return {
    async completeJson({
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      signal,
    }) {
      let requestMessages = messages;
      let lastError;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const completion = await requestCompletion({
          messages: requestMessages,
          temperature,
          maxTokens,
          jsonResponse: attempt === 0,
          signal,
        });

        try {
          if (
            completion.content.trim().length > 0 &&
            hasIncompleteFinishReason(completion.diagnostics)
          ) {
            throw new Error(
              `LLM response ended before a complete final answer (finish_reason=${
                completion.diagnostics.finishReason
              })`,
            );
          }
          return /** @type {object} */ (extractJsonValue(completion.content));
        } catch (error) {
          lastError = createResponseContentError(error, completion.diagnostics);
          if (attempt === 0) {
            requestMessages = [
              ...messages,
              { role: "user", content: JSON_RETRY_MESSAGE },
            ];
          }
        }
      }

      const detail = lastError instanceof Error
        ? lastError.message
        : "unknown JSON parsing error";
      throw new Error(`LLM JSON parsing failed after 2 attempts: ${detail}`);
    },

    async completeText({
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      signal,
    }) {
      const completion = await requestCompletion({
        messages,
        temperature,
        maxTokens,
        jsonResponse: false,
        signal,
      });
      if (!completion.content.trim()) {
        throw createResponseContentError(
          new Error("LLM response content was empty"),
          completion.diagnostics,
        );
      }
      if (hasIncompleteFinishReason(completion.diagnostics)) {
        throw createResponseContentError(
          new Error(
            `LLM response ended before a complete final answer (finish_reason=${
              completion.diagnostics.finishReason
            })`,
          ),
          completion.diagnostics,
        );
      }
      return completion.content;
    },
  };
}
