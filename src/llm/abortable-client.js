/**
 * 为仍保持旧公开签名的生成函数补充当前请求的取消信号。
 *
 * @param {{completeJson(request: object): Promise<object>, completeText?: (request: object) => Promise<string>}} llmClient
 * @param {AbortSignal | undefined} signal
 */
export function withAbortSignal(llmClient, signal) {
  if (signal === undefined) {
    return llmClient;
  }

  return {
    completeJson(request) {
      return llmClient.completeJson({ ...request, signal });
    },
    completeText(request) {
      if (typeof llmClient.completeText !== "function") {
        throw new Error("llmClient.completeText: expected a function");
      }
      return llmClient.completeText({ ...request, signal });
    },
  };
}
