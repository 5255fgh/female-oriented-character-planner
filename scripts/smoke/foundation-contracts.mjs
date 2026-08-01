import assert from "node:assert/strict";

import { assertCreativeSeed } from "../../src/contracts/character.js";
import {
  assertGenerationRecord,
  assertProjectDocument,
} from "../../src/contracts/project.js";
import {
  assertStoryDraft,
  assertWorldBible,
} from "../../src/contracts/world-story.js";

export async function runFoundationContractSmoke() {
  const seed = { text: "雨夜书店里，失忆调查员认出了不该存在的旧友。" };
  assert.equal(assertCreativeSeed(seed), seed);
  assert.throws(
    () => assertCreativeSeed({ text: "   " }),
    /CreativeSeed\.text/,
    "CreativeSeed 空文本错误必须包含字段路径",
  );

  const worldBible = {
    summary: "近未来港城，记忆档案可被合法交易。",
    rules: ["记忆只能转移，不能复制"],
    locations: ["潮汐档案馆"],
    factions: ["市政记忆局"],
    canonFacts: ["主角的旧案档案已被封存"],
    forbiddenFacts: ["不存在无代价的记忆恢复"],
  };
  assert.equal(assertWorldBible(worldBible), worldBible);
  assert.throws(
    () => assertWorldBible({ ...worldBible, rules: Array(9).fill("规则") }),
    /WorldBible\.rules/,
    "WorldBible 上限错误必须包含字段路径",
  );

  const storyDraft = {
    title: "潮汐失忆录",
    oneLiner: "她必须在真相与被偷走的关系之间选择。",
    userIdentity: "受托调查封存档案的律师",
    mainCharacters: ["调查员", "旧友"],
    premise: "一份不存在的档案重新出现。",
    coreConflict: "公开真相会永久抹去一段关系。",
    initialScene: "停电后的档案馆",
    openingLine: "你来晚了，档案已经记住了你的名字。",
    keyNodes: Array.from({ length: 8 }, (_, index) => `节点 ${index + 1}`),
    branches: [],
    foreshadowing: ["反复出现的潮汐时间"],
    stateVariables: [],
  };
  assert.equal(assertStoryDraft(storyDraft), storyDraft);
  assert.throws(
    () => assertStoryDraft({ ...storyDraft, keyNodes: storyDraft.keyNodes.slice(0, 7) }),
    /StoryDraft\.keyNodes/,
    "StoryDraft 节点数量错误必须包含字段路径",
  );

  const generationRecord = {
    id: "generation-1",
    task: "world-generation",
    target: "worldBible",
    status: "completed",
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  assert.equal(assertGenerationRecord(generationRecord), generationRecord);

  const project = {
    id: "project-v2-smoke",
    title: "中间态项目",
    seed,
    brief: null,
    concepts: [],
    selectedConceptId: null,
    character: null,
    worldBible: null,
    storyDraft: null,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    generationRecords: [generationRecord],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  assert.equal(assertProjectDocument(project), project, "ProjectDocument 应允许只保存 seed");
  assert.throws(
    () => assertProjectDocument({ ...project, storyDraft: { ...storyDraft, branches: Array(5).fill("分支") } }),
    /ProjectDocument\.storyDraft\.branches/,
    "嵌套契约错误必须保留 ProjectDocument 字段路径",
  );
}
