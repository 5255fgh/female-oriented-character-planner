import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyBrief,
  createInitialAppState,
} from "../../src/app-state.js";
import { createCoreFlowMockLLMClient } from "../../src/mock/index.js";
import { renderApp } from "../../src/ui/renderers.js";
import { renderProgressScreen } from "../../src/ui/screens/brief-screen.js";
import {
  renderCharacterEditor,
  renderCharacterSummary,
  renderRevisionPanel,
  renderStorySummary,
} from "../../src/ui/screens/character-screen.js";
import { renderQuickCheck } from "../../src/ui/screens/evaluation-screen.js";
import { renderPlatformOutput } from "../../src/ui/screens/output-screen.js";
import {
  renderAutosavePill,
  renderFeedback,
} from "../../src/ui/rendering.js";

const mockClient = createCoreFlowMockLLMClient();
const character = await mockClient.completeJson({
  task: "character-expansion",
  messages: [],
});
const storyDraft = await mockClient.completeJson({
  task: "story-generation",
  messages: [],
});
const worldBible = await mockClient.completeJson({
  task: "world-generation",
  messages: [],
});
const platformPack = await mockClient.completeJson({
  task: "maoxiang-free-character",
  messages: [],
});

function createBriefFixture() {
  return {
    ...createEmptyBrief(),
    characterGender: "男",
    ageRange: "25—30",
    worldSetting: "架空王城",
    characterIdentity: "禁书库档案官",
    coreExperiences: ["因旧案失去家族名誉"],
    relationshipType: "契约盟友",
    coreConflict: "公开真相会同时伤害双方家族",
    personalityContradiction: "守序却会为重要的人打破规则",
    initiativeLevel: "high",
    interactionTone: ["克制", "平等"],
    boundaries: ["尊重拒绝", "不替用户决定"],
    bannedBehaviors: ["威胁", "控制社交"],
  };
}

function createCharacterResultState() {
  const state = createInitialAppState();
  const timestamp = "2026-08-01T00:00:00.000Z";
  const characterSnapshot = structuredClone(character);
  characterSnapshot.meta.updatedAt = timestamp;
  const platformPackSnapshot = structuredClone(platformPack);
  platformPackSnapshot.generatedAt = timestamp;
  state.currentStep = "result";
  state.projectKind = "character";
  state.autosaveStatus = "saved";
  state.project = {
    id: "project-ui-test",
    title: "雨夜档案官",
    seed: { text: "雨夜禁书库中的契约盟友" },
    brief: createBriefFixture(),
    concepts: [],
    selectedConceptId: null,
    character: characterSnapshot,
    worldBible: null,
    storyDraft: null,
    ruleReport: {
      status: "warning",
      issues: [
        {
          code: "limited-heuristic",
          severity: "warning",
          fieldPath: "persona.initiativeRules",
          message: "主动行为还可以更具体。",
          evidence: "当前只有有限动作词。",
          suggestedAction: "补充一个可观察动作。",
        },
      ],
    },
    simulationReport: null,
    platformPacks: [platformPackSnapshot],
    generationRecords: [{
      id: "generation-quick-check",
      task: "quick-check",
      target: "character",
      status: "completed",
      createdAt: timestamp,
    }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return state;
}

function createStoryResultState() {
  const state = createInitialAppState();
  state.currentStep = "result";
  state.projectKind = "story";
  state.project.storyDraft = structuredClone(storyDraft);
  state.project.worldBible = structuredClone(worldBible);
  state.project.title = storyDraft.title;
  state.storyCheck = {
    status: "pass",
    message: "故事结构已通过共享契约校验，包含正好 8 个关键节点。",
  };
  return state;
}

test("快速入口只突出一句话、可选约束和两种生成动作", () => {
  const state = createInitialAppState();
  state.currentStep = "create";
  const html = renderApp(state, { model: "test-model" });

  assert.match(html, /一句话灵感/);
  assert.match(html, /必须出现（可选）/);
  assert.match(html, /不要出现（可选）/);
  assert.match(html, />直接生成</);
  assert.match(html, />探索 3 个方向</);
  assert.match(html, /<details class="advanced-brief">/);
});

test("追问 UI 最多渲染 3 题并显示推荐与跳过路径", () => {
  const state = createInitialAppState();
  state.currentStep = "questions";
  state.questions = Array.from({ length: 4 }, (_, index) => ({
    id: `question-${index}`,
    prompt: `高影响问题 ${index + 1}`,
    options: ["选项 A", "选项 B", "选项 C"],
    recommended: "选项 B",
  }));
  const html = renderApp(state, { model: "test-model" });

  assert.equal((html.match(/class="card question-card"/g) || []).length, 3);
  assert.doesNotMatch(html, /高影响问题 4/);
  assert.match(html, /推荐/);
  assert.match(html, /采用推荐并继续/);
  assert.match(html, /跳过问题/);
});

test("开放故事追问使用故事语境而不是角色语境", () => {
  const state = createInitialAppState();
  state.currentStep = "questions";
  state.projectKind = "story";
  state.questions = [{
    id: "tension",
    prompt: "哪种核心张力最适合推动这名角色主动行动？",
    options: ["共同调查秘密", "价值观冲突"],
    recommended: "共同调查秘密",
  }];
  const html = renderApp(state, { model: "test-model" });

  assert.match(html, /哪种核心张力最适合持续推动故事？/);
  assert.doesNotMatch(html, /推动这名角色主动行动/);
});

test("角色摘要包含任务要求的九类信息", () => {
  const html = renderCharacterSummary(createCharacterResultState());
  for (const label of ["名称", "定位", "世界", "身份", "关系", "冲突", "主动行为", "边界", "开场"]) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  assert.match(html, /沈砚舟/);
});

test("故事摘要包含标题、开场和正好八个节点", () => {
  const state = createStoryResultState();
  const html = renderStorySummary(state);

  for (const label of ["标题", "卖点", "用户身份", "世界", "主要角色", "冲突", "开场", "八个节点"]) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  for (const node of storyDraft.keyNodes) assert.match(html, new RegExp(node));
});

test("warning 不阻止有效平台字段复制", () => {
  const state = createCharacterResultState();
  const html = renderPlatformOutput(state);
  const copyButton = html.match(/<button[^>]+data-action="copy-pack-block"[^>]*>/)?.[0];

  assert.ok(copyButton);
  assert.match(copyButton, /data-copy-valid="true"/);
  assert.doesNotMatch(copyButton, / disabled/);
  assert.equal(state.project.ruleReport.status, "warning");
});

test("角色项目可分别生成四种输入包且不要求先运行检查", () => {
  const state = createCharacterResultState();
  state.project.ruleReport = null;
  state.quickDialogueReport = null;
  const html = renderPlatformOutput(state);

  for (const flowId of [
    "editor_character",
    "free_character",
    "dead_rival",
    "image_shape",
  ]) {
    assert.match(
      html,
      new RegExp(`data-action="generate-platform-pack"[^>]+data-pack-flow="${flowId}"`),
    );
  }
  assert.match(html, /输入包可独立生成，不要求先运行质量检查/);
});

test("未知平台上限使用中性提示且不阻止复制", () => {
  const state = createCharacterResultState();
  const block = state.project.platformPacks[0].blocks[0];
  Object.assign(block, {
    maxLength: null,
    verified: false,
    valid: true,
  });
  const html = renderPlatformOutput(state);
  const copyButton = html.match(/<button[^>]+data-action="copy-pack-block"[^>]*>/)?.[0];

  assert.match(html, /平台上限尚未核验/);
  assert.doesNotMatch(html, /上限未确认|限制未确认/);
  assert.match(copyButton, /data-copy-valid="true"/);
  assert.doesNotMatch(copyButton, / disabled/);
});

test("规则 error 会阻止复制，但不把平台字段伪装成超限", () => {
  const state = createCharacterResultState();
  state.project.ruleReport = {
    status: "fail",
    issues: [{
      code: "missing-goal",
      severity: "error",
      fieldPath: "persona.currentGoal",
      message: "当前目标为空。",
      evidence: "persona.currentGoal 为空。",
      suggestedAction: "补充角色自己的当前目标。",
    }],
  };

  const html = renderPlatformOutput(state);
  const copyButton = html.match(/<button[^>]+data-action="copy-pack-block"[^>]*>/)?.[0];

  assert.match(copyButton, /data-copy-valid="false"/);
  assert.match(copyButton, / disabled/);
  assert.match(html, /固定规则仍有错误/);
  assert.match(html, /data-pack-validity="valid"/);
});

test("角色修改后保留旧检查和输入包并标记可能已过期", () => {
  const state = createCharacterResultState();
  state.project.ruleReport = {
    status: "fail",
    issues: [{
      code: "old-error",
      severity: "error",
      fieldPath: "persona.currentGoal",
      message: "旧检查错误。",
      evidence: "旧证据。",
      suggestedAction: "重新检查。",
    }],
  };
  state.project.character.meta.updatedAt = "2026-08-01T01:00:00.000Z";

  const checkHtml = renderQuickCheck(state);
  const outputHtml = renderPlatformOutput(state);
  const copyButton = outputHtml.match(/<button[^>]+data-action="copy-pack-block"[^>]*>/)?.[0];

  assert.match(checkHtml, /可能已过期/);
  assert.match(checkHtml, /旧检查错误/);
  assert.match(outputHtml, /可能已过期/);
  assert.match(copyButton, /data-copy-valid="true"/);
  assert.doesNotMatch(copyButton, / disabled/);
});

test("已知超限字段明确无效且复制按钮禁用，不截断文本", () => {
  const state = createCharacterResultState();
  const overLimitText = "字".repeat(1001);
  const block = state.project.platformPacks[0].blocks[0];
  Object.assign(block, {
    text: overLimitText,
    currentLength: 1001,
    maxLength: 1000,
    valid: false,
  });
  const html = renderPlatformOutput(state);
  const copyButton = html.match(/<button[^>]+data-action="copy-pack-block"[^>]*>/)?.[0];

  assert.match(html, /已知超限 1 字/);
  assert.match(html, new RegExp(overLimitText.slice(0, 20)));
  assert.match(copyButton, /data-copy-valid="false"/);
  assert.match(copyButton, / disabled/);
});

test("字段提案展示 before、after、diff 与确认控件", () => {
  const state = createCharacterResultState();
  const before = state.project.character.persona.identity;
  const after = `${before}，兼任旧案复核员。`;
  state.pendingRevision = {
    fieldPath: "persona.identity",
    before,
    after,
    summary: "补充职责范围。",
  };
  state.revisionDiff = {
    kind: "text",
    changed: true,
    replacement: false,
    changes: [
      { type: "equal", path: "$", value: before },
      { type: "add", path: "$", value: "，兼任旧案复核员。" },
    ],
  };
  const reviewHtml = renderRevisionPanel(state);

  assert.match(reviewHtml, />Before</);
  assert.match(reviewHtml, />After</);
  assert.match(reviewHtml, />Diff</);
  assert.match(reviewHtml, /data-action="confirm-revision"/);
  assert.equal(state.project.character.persona.identity, before);
});

test("Undo 在存在最近确认记录时可用", () => {
  const state = createCharacterResultState();
  const before = state.project.character.persona.identity;
  const after = `${before}，兼任旧案复核员。`;
  state.revisionHistory = [{
    fieldPath: "persona.identity",
    before,
    after,
    appliedAt: "2026-08-01T01:00:00.000Z",
  }];

  const editorHtml = renderCharacterEditor(state);
  const undoButton = editorHtml.match(/<button[^>]+data-action="undo-revision"[^>]*>/)?.[0];
  assert.ok(undoButton);
  assert.doesNotMatch(undoButton, / disabled/);
});

test("字段直改后高级编辑保持展开并定位到当前字段", () => {
  const state = createCharacterResultState();
  const nextValue = "克制守序的档案官，会主动邀请你共同核对证据。";

  state.project.character.publicInfo.oneLiner = nextValue;
  state.activeFieldPath = "publicInfo.oneLiner";
  const editorHtml = renderCharacterEditor(state);

  assert.equal(state.activeFieldPath, "publicInfo.oneLiner");
  assert.match(editorHtml, /<details class="advanced-editor" id="advanced-editor" open>/);
  assert.match(editorHtml, new RegExp(nextValue));
});

test("自动保存状态分别渲染保存中、已保存和保存失败", () => {
  const state = createInitialAppState();
  for (const [status, label] of [["saving", "保存中"], ["saved", "已保存"], ["error", "保存失败"]]) {
    state.autosaveStatus = status;
    const html = renderAutosavePill(state);
    assert.match(html, new RegExp(label));
    assert.match(html, new RegExp(`data-status="${status}"`));
  }
});

test("可取消的模型请求在通用加载反馈中提供取消按钮", () => {
  const state = createInitialAppState();
  state.currentStep = "result";
  state.loading = true;
  state.pendingAction = "full-simulation";

  const html = renderFeedback(state);
  assert.match(html, /data-action="cancel-current-request"/);
});

test("取消任务状态只标记当前真实阶段为已取消", () => {
  const state = createInitialAppState();
  state.currentStep = "progress";
  state.progressStatus = "running";
  state.progress[0].status = "complete";
  state.progress[1].status = "active";
  state.progress[1].status = "cancelled";
  state.progressStatus = "cancelled";
  const html = renderProgressScreen(state);

  assert.equal(state.progress[0].status, "complete");
  assert.equal(state.progress[1].status, "cancelled");
  assert.match(html, /data-progress-status="cancelled"/);
  assert.match(html, /任务已取消/);
});
