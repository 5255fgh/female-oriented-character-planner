import assert from "node:assert/strict";
import test from "node:test";

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
