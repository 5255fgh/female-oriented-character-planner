import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

import { createProject } from "../evaluation/fixtures.js";

let vite;
let editing;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: "custom",
    logLevel: "error",
  });
  editing = await vite.ssrLoadModule("/src/editing/index.js");
});

after(async () => {
  await vite.close();
});

test("字段提案不修改源项目，也不发送完整无关项目上下文", async () => {
  const project = createProject();
  project.title = "不应发送的项目标题";
  project.storyDraft.title = "不应发送的完整故事标题";
  const snapshot = structuredClone(project);
  const requests = [];
  const beforeValue = project.character.persona.currentGoal;
  const afterValue = "在三天后的审判前找到带原始签章的证词卷宗。";
  const llmClient = {
    async completeJson(request) {
      requests.push(request);
      return {
        fieldPath: "persona.currentGoal",
        before: beforeValue,
        after: afterValue,
        summary: "加入时限与明确证据对象。",
      };
    },
  };

  const revision = await editing.proposeFieldRevision(
    project,
    "persona.currentGoal",
    "把目标写得更具体",
    { reason: "规则提醒" },
    llmClient,
  );

  assert.deepEqual(project, snapshot);
  assert.equal(revision.after, afterValue);
  const sentContent = requests[0].messages.map((message) => message.content).join("\n");
  assert.doesNotMatch(sentContent, /不应发送的项目标题/u);
  assert.doesNotMatch(sentContent, /不应发送的完整故事标题/u);
  assert.doesNotMatch(sentContent, /generationRecords/u);
});

test("字段提案校验 after 的原字段类型，并且格式错误最多重试一次", async () => {
  const project = createProject();
  const original = project.character.persona.currentGoal;
  let callCount = 0;
  const llmClient = {
    async completeJson() {
      callCount += 1;
      return callCount === 1
        ? {
            fieldPath: "persona.currentGoal",
            before: original,
            after: ["错误类型"],
            summary: "错误提案",
          }
        : {
            fieldPath: "persona.currentGoal",
            before: original,
            after: "在审判前找到原始签章卷宗。",
            summary: "补充证据对象。",
          };
    },
  };

  const revision = await editing.proposeFieldRevision(
    project,
    "persona.currentGoal",
    "补充证据对象",
    null,
    llmClient,
  );
  assert.equal(callCount, 2);
  assert.equal(typeof revision.after, "string");
});

test("字段提案拒绝模型改写请求路径", async () => {
  const project = createProject();
  let callCount = 0;
  const llmClient = {
    async completeJson() {
      callCount += 1;
      return callCount === 1
        ? {
            fieldPath: "persona.desire",
            before: project.character.persona.desire,
            after: "让所有旧案都由公开证据复核。",
            summary: "错误地改写了另一个字段。",
          }
        : {
            fieldPath: "persona.currentGoal",
            before: project.character.persona.currentGoal,
            after: "在审判前找到原始签章卷宗。",
            summary: "保持原始请求路径。",
          };
    },
  };

  const revision = await editing.proposeFieldRevision(
    project,
    "persona.currentGoal",
    "明确证据对象",
    null,
    llmClient,
  );
  assert.equal(callCount, 2);
  assert.equal(revision.fieldPath, "persona.currentGoal");
});

test("确认只改变目标字段和时间，并保留旧检查与平台包供对照", () => {
  const project = createProject();
  const snapshot = structuredClone(project);
  const beforeValue = project.character.persona.currentGoal;
  const revision = {
    fieldPath: "persona.currentGoal",
    before: beforeValue,
    after: "在审判前找到带原始签章的证词卷宗。",
    summary: "明确证据对象。",
  };

  const result = editing.applyConfirmedRevision(project, revision);
  assert.deepEqual(project, snapshot);
  assert.equal(result.project.character.persona.currentGoal, revision.after);
  assert.notEqual(
    result.project.character.meta.updatedAt,
    project.character.meta.updatedAt,
  );
  assert.deepEqual(result.project.ruleReport, project.ruleReport);
  assert.deepEqual(result.project.simulationReport, project.simulationReport);
  assert.equal(result.project.storyDraft, null);
  assert.deepEqual(result.project.platformPacks, project.platformPacks);
  assert.deepEqual(result.project.worldBible, project.worldBible);

  const normalizedCharacter = structuredClone(result.project.character);
  normalizedCharacter.persona.currentGoal = beforeValue;
  normalizedCharacter.meta.updatedAt = project.character.meta.updatedAt;
  assert.deepEqual(normalizedCharacter, project.character);
  assert.deepEqual(result.historyEntry.before, beforeValue);
  assert.deepEqual(result.historyEntry.after, revision.after);
});

test("Diff 对文本、数组和完全替换产生稳定输出", () => {
  const textDiff = editing.createRevisionDiff("克制但疏离", "克制而坚定");
  assert.deepEqual(
    textDiff,
    editing.createRevisionDiff("克制但疏离", "克制而坚定"),
  );
  assert.equal(textDiff.kind, "text");
  assert.equal(textDiff.replacement, false);
  assert.ok(textDiff.changes.some((change) => change.type === "remove"));
  assert.ok(textDiff.changes.some((change) => change.type === "add"));

  const arrayDiff = editing.createRevisionDiff(["线索 A", "线索 B"], [
    "线索 A",
    "线索 C",
    "线索 B",
  ]);
  assert.equal(arrayDiff.kind, "array");
  assert.ok(
    arrayDiff.changes.some(
      (change) => change.type === "add" && change.value === "线索 C",
    ),
  );

  const replacement = editing.createRevisionDiff("完全不同", "另一段文字");
  assert.equal(replacement.replacement, true);
});

test("撤销恢复修改前值并继续保留旧检查与平台包", () => {
  const project = createProject();
  const beforeValue = project.character.persona.currentGoal;
  const applied = editing.applyConfirmedRevision(project, {
    fieldPath: "persona.currentGoal",
    before: beforeValue,
    after: "在审判前找回原始签章卷宗。",
    summary: "明确对象。",
  });
  const history = editing.appendRevisionHistory([], applied.historyEntry);
  const appliedSnapshot = structuredClone(applied.project);

  const undone = editing.undoRevision(applied.project, history);
  assert.deepEqual(applied.project, appliedSnapshot);
  assert.equal(undone.project.character.persona.currentGoal, beforeValue);
  assert.deepEqual(undone.history, []);
  assert.deepEqual(undone.project.ruleReport, applied.project.ruleReport);
  assert.deepEqual(
    undone.project.simulationReport,
    applied.project.simulationReport,
  );
  assert.deepEqual(undone.project.platformPacks, applied.project.platformPacks);
});

test("历史仅保留最近 20 次字段修改", () => {
  let history = [];
  for (let index = 0; index < 21; index += 1) {
    history = editing.appendRevisionHistory(history, {
      fieldPath: "persona.currentGoal",
      before: `目标 ${index}`,
      after: `目标 ${index + 1}`,
      appliedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    });
  }

  assert.equal(history.length, 20);
  assert.equal(history[0].before, "目标 1");
  assert.equal(history.at(-1).after, "目标 21");
});

test("规则修复只为明确选择的问题生成一轮提案，不应用或循环复检", async () => {
  const project = createProject();
  const snapshot = structuredClone(project);
  const selectedId = editing.getRuleIssueId(project.ruleReport.issues[0], 0);
  let callCount = 0;
  const llmClient = {
    async completeJson() {
      callCount += 1;
      return {
        fieldPath: "persona.currentGoal",
        before: project.character.persona.currentGoal,
        after: "在三天后的审判前找到带原始签章的证词卷宗。",
        summary: "加入时限和证据对象。",
      };
    },
  };

  const proposals = await editing.proposeRuleFixes(
    project,
    [selectedId],
    llmClient,
  );
  assert.equal(callCount, 1);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].fieldPath, "persona.currentGoal");
  assert.deepEqual(project, snapshot);

  const none = await editing.proposeRuleFixes(project, [], llmClient);
  assert.deepEqual(none, []);
  assert.equal(callCount, 1);
});
