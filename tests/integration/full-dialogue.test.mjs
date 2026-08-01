import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

import { createCharacter } from "../evaluation/fixtures.js";

let vite;
let assertSimulationReport;
let createMockLLMClient;
let runDialogueTest;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: "custom",
    logLevel: "error",
  });

  ({ assertSimulationReport } = await vite.ssrLoadModule("/src/contracts.js"));
  ({ createMockLLMClient } = await vite.ssrLoadModule("/src/mock/index.js"));
  ({ runDialogueTest } = await vite.ssrLoadModule("/src/evaluation/index.js"));
});

after(async () => {
  await vite?.close();
});

test("完整评估一次请求返回固定八场景", async () => {
  const requests = [];
  const delegate = createMockLLMClient();
  const client = {
    completeText(request) {
      return delegate.completeText(request);
    },
    completeJson(request) {
      requests.push(request);
      return delegate.completeJson(request);
    },
  };

  const report = await runDialogueTest(createCharacter(), client);
  assertSimulationReport(report);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].task, "dialogue-evaluation");
  assert.equal(report.scenarios.length, 8);
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.scenarioId).sort(),
    [
      "refusal",
      "short_replies",
      "motive_question",
      "low_mood",
      "user_approaches",
      "important_other",
      "out_of_character_request",
      "long_conversation_progress",
    ].sort(),
  );
});
