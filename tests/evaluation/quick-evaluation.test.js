import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

import {
  createCharacter,
  createQuickReport,
} from "./fixtures.js";

let vite;
let checkRules;
let runQuickDialogueTest;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: "custom",
    logLevel: "error",
  });
  ({ checkRules } = await vite.ssrLoadModule("/src/evaluation/rule-checker.js"));
  ({ runQuickDialogueTest } = await vite.ssrLoadModule(
    "/src/evaluation/quick-dialogue-tester.js",
  ));
});

after(async () => {
  await vite.close();
});

test("快速测试固定返回正好三个场景，warning 不阻断输出", async () => {
  const requests = [];
  const llmClient = {
    async completeJson(request) {
      requests.push(request);
      return createQuickReport("warning");
    },
  };

  const report = await runQuickDialogueTest(createCharacter(), llmClient);
  assert.equal(report.status, "warning");
  assert.equal(report.scenarios.length, 3);
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.scenarioId),
    ["refusal", "motive_question", "out_of_character_request"],
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].task, "quick-dialogue-test");
});

test("快速测试拒绝不存在的 suggestedFields，并且最多重试一次", async () => {
  let callCount = 0;
  const llmClient = {
    async completeJson() {
      callCount += 1;
      const report = createQuickReport();
      report.scenarios[0].suggestedFields = ["persona.notARealField"];
      return report;
    },
  };

  await assert.rejects(
    runQuickDialogueTest(createCharacter(), llmClient),
    /suggestedFields\[0\].*existing CharacterDraft field path/u,
  );
  assert.equal(callCount, 2);
});

test("快速测试证据必须逐字引用当前角色回复", async () => {
  let callCount = 0;
  const llmClient = {
    async completeJson() {
      callCount += 1;
      const report = createQuickReport();
      report.scenarios[1].evidence = ["“你为什么一定要找到它”来自用户输入。"];
      return report;
    },
  };

  await assert.rejects(
    runQuickDialogueTest(createCharacter(), llmClient),
    /exact quote from characterResponse/u,
  );
  assert.equal(callCount, 2);
});

test("确定性检查把缺失、类型和非法结构问题作为阻断错误报告", () => {
  const missing = createCharacter();
  delete missing.persona.currentGoal;
  assert.equal(checkRules(missing).issues[0].code, "MISSING_REQUIRED_FIELD");

  const invalidType = createCharacter();
  invalidType.persona.currentGoal = ["错误类型"];
  assert.equal(checkRules(invalidType).issues[0].code, "INVALID_CHARACTER_TYPE");

  const illegal = createCharacter();
  illegal.persona.unexpected = "契约外字段";
  assert.equal(checkRules(illegal).issues[0].code, "ILLEGAL_CHARACTER_STRUCTURE");

  for (const candidate of [missing, invalidType, illegal]) {
    const report = checkRules(candidate);
    assert.equal(report.status, "fail");
    assert.equal(report.issues[0].severity, "error");
  }
});

test("启发式问题保持 warning，且不使用主观百分制措辞", () => {
  const character = createCharacter();
  character.persona.currentGoal = "一直陪伴用户";
  const report = checkRules(character);

  assert.equal(report.status, "warning");
  assert.ok(report.issues.some((issue) => issue.code === "DEPENDENT_CURRENT_GOAL"));
  assert.ok(report.issues.every((issue) => issue.severity === "warning"));
  assert.doesNotMatch(
    report.issues.map((issue) => issue.message).join("\n"),
    /(?:百分制|\d{1,3}\s*分)/u,
  );
});
