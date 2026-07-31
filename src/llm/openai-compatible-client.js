const JSON_RESPONSE_FORMAT = { type: "json_object" };
const JSON_RETRY_MESSAGE =
  "只返回一个合法 JSON 值，不要使用 Markdown 代码围栏，不要添加解释文字。";
const MAX_ERROR_SUMMARY_LENGTH = 500;

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

  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const responseBody = /** @type {{error?: unknown, message?: unknown}} */ (payload);
    if (
      responseBody.error !== null &&
      typeof responseBody.error === "object" &&
      !Array.isArray(responseBody.error)
    ) {
      const upstreamError = /** @type {{message?: unknown, type?: unknown, code?: unknown}} */ (
        responseBody.error
      );
      message = summarizeErrorField(upstreamError.message, MAX_ERROR_SUMMARY_LENGTH);
      type = summarizeErrorField(upstreamError.type, 100);
      code = summarizeErrorField(upstreamError.code, 100);
    } else if (typeof responseBody.error === "string") {
      message = summarizeErrorField(responseBody.error, MAX_ERROR_SUMMARY_LENGTH);
    }

    if (!message && typeof responseBody.message === "string") {
      message = summarizeErrorField(responseBody.message, MAX_ERROR_SUMMARY_LENGTH);
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
 * @returns {boolean}
 */
function hasUpstreamError(payload) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.prototype.hasOwnProperty.call(payload, "error") &&
    payload.error !== null &&
    payload.error !== undefined
  );
}

/**
 * @param {Response} response
 * @returns {Promise<{payload: unknown, rawText: string, parseError: unknown}>}
 */
async function readResponseBody(response) {
  if (typeof response.text === "function") {
    try {
      const rawText = await response.text();
      try {
        return {
          payload: rawText.length > 0 ? JSON.parse(rawText) : null,
          rawText,
          parseError: null,
        };
      } catch (error) {
        return { payload: null, rawText, parseError: error };
      }
    } catch (error) {
      return {
        payload: null,
        rawText: "",
        parseError: error,
      };
    }
  }

  try {
    return { payload: await response.json(), rawText: "", parseError: null };
  } catch (error) {
    return { payload: null, rawText: "", parseError: error };
  }
}

/**
 * 将字符串或兼容接口的文本内容数组合并为原始文本。
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
  if (Array.isArray(rawContent)) {
    return rawContent.map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (
        part !== null &&
        typeof part === "object" &&
        !Array.isArray(part) &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    }).join("");
  }
  throw new Error(
    "LLM response message.content must be a string or an array of text parts",
  );
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
 *     maxTokens?: number
 *   }): Promise<object>,
 *   completeText(request: {
 *     task: string,
 *     messages: unknown[],
 *     temperature?: number,
 *     maxTokens?: number
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
   *   jsonResponse: boolean
   * }} request
   * @returns {Promise<unknown>}
   */
  async function requestCompletion({ messages, temperature, maxTokens, jsonResponse }) {
    const requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
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
    });
    const { payload, rawText, parseError } = await readResponseBody(response);

    if (!response.ok || hasUpstreamError(payload)) {
      const summary = summarizeUpstreamError(payload, rawText, response.statusText);
      const errorKind = response.ok
        ? "LLM upstream returned an error"
        : "LLM request failed";
      throw new Error(`${errorKind} with status ${response.status}: ${summary}`);
    }

    if (parseError || payload === null || typeof payload !== "object") {
      throw new Error("LLM upstream response was not valid JSON");
    }

    const content = /** @type {{choices?: Array<{message?: {content?: unknown}}>}} */ (payload)
      .choices?.[0]?.message?.content;
    return content ?? "";
  }

  return {
    async completeJson({ messages, temperature = 0.7, maxTokens = 4096 }) {
      let requestMessages = messages;
      let lastError;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const content = await requestCompletion({
          messages: requestMessages,
          temperature,
          maxTokens,
          jsonResponse: true,
        });

        try {
          return /** @type {object} */ (extractJsonValue(content));
        } catch (error) {
          lastError = error;
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

    async completeText({ messages, temperature = 0.7, maxTokens = 4096 }) {
      const content = await requestCompletion({
        messages,
        temperature,
        maxTokens,
        jsonResponse: false,
      });
      return messageContentToText(content);
    },
  };
}
