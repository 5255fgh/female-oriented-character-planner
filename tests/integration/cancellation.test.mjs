import assert from "node:assert/strict";
import test from "node:test";

import { createLLMClient } from "../../src/llm/openai-compatible-client.js";
import { createTaskRunner } from "../../src/workflow/index.js";
import { createProject } from "../storage/fixtures.mjs";

test("已取消请求的迟到结果不会污染当前项目", async () => {
  const runner = createTaskRunner();
  const originalProject = createProject({
    seed: { text: "雨夜档案官与继承人追查旧案。" },
  });
  const originalSnapshot = structuredClone(originalProject);
  let currentProject = structuredClone(originalProject);
  let resolveTransport;
  let observedSignal;

  const request = runner.run("character-generation", ({ signal }) => {
    observedSignal = signal;
    return new Promise((resolve) => {
      resolveTransport = resolve;
    });
  });
  const commit = request.then((nextProject) => {
    currentProject = nextProject;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(runner.cancel("character-generation"), true);
  await assert.rejects(commit, { name: "AbortError" });
  assert.equal(observedSignal.aborted, true);

  resolveTransport({ ...originalProject, title: "不应提交的迟到结果" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(currentProject, originalSnapshot);
  assert.deepEqual(originalProject, originalSnapshot);
  assert.equal(runner.isRunning("character-generation"), false);
});

test("真实 LLM 客户端把取消信号传给底层 HTTP 请求", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let observedSignal;

  globalThis.fetch = async (_url, options) => {
    observedSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => reject(new DOMException("已取消", "AbortError")),
        { once: true },
      );
    });
  };

  try {
    const client = createLLMClient({
      endpoint: "/test/llm",
      model: "test-model",
    });
    const request = client.completeText({
      task: "signal-forwarding",
      messages: [{ role: "user", content: "test" }],
      signal: controller.signal,
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observedSignal, controller.signal);
    controller.abort();
    await assert.rejects(request, { name: "AbortError" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
