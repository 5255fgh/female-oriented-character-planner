const JSON_RESPONSE_FORMAT = { type: "json_object" };
const JSON_RETRY_MESSAGE =
  "上一次响应为空或不是有效 JSON。只返回有效 JSON 对象，不要使用 Markdown 代码围栏，也不要添加解释文字。";
const MAX_ERROR_SUMMARY_LENGTH = 300;

/**
 * @param {unknown} payload
 * @param {string} rawText
 * @param {string} statusText
 * @returns {string}
 */
function summarizeUpstreamError(payload, rawText, statusText) {
  let summary = "";

  if (payload !== null && typeof payload === "object") {
    const responseBody = /** @type {{error?: unknown, message?: unknown}} */ (payload);
    if (responseBody.error !== null && typeof responseBody.error === "object") {
      const upstreamError = /** @type {{message?: unknown}} */ (responseBody.error);
      if (typeof upstreamError.message === "string") {
        summary = upstreamError.message;
      }
    } else if (typeof responseBody.error === "string") {
      summary = responseBody.error;
    }

    if (!summary && typeof responseBody.message === "string") {
      summary = responseBody.message;
    }
  }

  if (!summary) {
    summary = rawText || statusText || "upstream request failed";
  }

  const normalizedSummary = summary
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_SUMMARY_LENGTH);
  return normalizedSummary || "upstream request failed";
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
 * @param {string} content
 * @returns {unknown}
 */
function parseJsonContent(content) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("LLM response content was empty");
  }

  // 结构化响应必须是原始 JSON；Markdown 围栏应视为无效并触发一次重试。
  return JSON.parse(trimmed);
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
   * @returns {Promise<string>}
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

    if (!response.ok) {
      const summary = summarizeUpstreamError(payload, rawText, response.statusText);
      throw new Error(`LLM request failed with status ${response.status}: ${summary}`);
    }

    if (parseError || payload === null || typeof payload !== "object") {
      throw new Error("LLM upstream response was not valid JSON");
    }

    const content = /** @type {{choices?: Array<{message?: {content?: unknown}}>}} */ (payload)
      .choices?.[0]?.message?.content;
    if (content === null || content === undefined) {
      return "";
    }
    if (typeof content !== "string") {
      throw new Error("LLM upstream response content was not a string");
    }
    return content;
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
          return /** @type {object} */ (parseJsonContent(content));
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

      throw /** @type {Error} */ (lastError);
    },

    async completeText({ messages, temperature = 0.7, maxTokens = 4096 }) {
      return requestCompletion({
        messages,
        temperature,
        maxTokens,
        jsonResponse: false,
      });
    },
  };
}
