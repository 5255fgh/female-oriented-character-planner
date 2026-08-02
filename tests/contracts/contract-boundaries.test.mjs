import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCreativeSeed,
  assertStoryDraft,
  assertWorldBible,
} from "../../src/contracts.js";

function createWorldBible() {
  return {
    summary: "王城档案制度决定旧案证据的效力。",
    rules: Array.from({ length: 8 }, (_, index) => `规则${index + 1}`),
    locations: Array.from({ length: 5 }, (_, index) => `地点${index + 1}`),
    factions: Array.from({ length: 4 }, (_, index) => `势力${index + 1}`),
    canonFacts: ["原始卷宗仍然存在。"],
    forbiddenFacts: ["不得用全知力量直接解决旧案。"],
  };
}

function createStoryDraft() {
  return {
    title: "雨夜卷宗",
    oneLiner: "在议会销毁档案前找回旧案真相。",
    userIdentity: "持有旁证的继承人",
    mainCharacters: ["用户", "沈砚舟"],
    premise: "禁书库将在黎明接受清点。",
    coreConflict: "公开证据会同时伤害双方家族。",
    initialScene: "雨夜的封禁书库",
    openingLine: "拆开之前，你仍有离开的选择。",
    keyNodes: Array.from({ length: 8 }, (_, index) => `节点${index + 1}`),
    branches: ["公开证据"],
    foreshadowing: ["卷宗暗号"],
    stateVariables: [],
  };
}

test("CreativeSeed 只接受非空 text 且拒绝合同外字段", () => {
  assert.deepEqual(assertCreativeSeed({ text: "一句话角色灵感" }), {
    text: "一句话角色灵感",
  });
  assert.throws(() => assertCreativeSeed({ text: "   " }), /CreativeSeed\.text/u);
  assert.throws(
    () => assertCreativeSeed({ text: "一句话角色灵感", title: "额外字段" }),
    /CreativeSeed\.title/u,
  );
});

test("WorldBible 与 StoryDraft 的数量上限是硬契约", () => {
  const worldBible = createWorldBible();
  const storyDraft = createStoryDraft();

  assert.doesNotThrow(() => assertWorldBible(worldBible));
  assert.doesNotThrow(() => assertStoryDraft(storyDraft));
  assert.throws(
    () => assertWorldBible({ ...worldBible, rules: [...worldBible.rules, "第九条"] }),
    /WorldBible\.rules/u,
  );
  assert.throws(
    () => assertStoryDraft({ ...storyDraft, keyNodes: storyDraft.keyNodes.slice(0, 7) }),
    /StoryDraft\.keyNodes/u,
  );
});
