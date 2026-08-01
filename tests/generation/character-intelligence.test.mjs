import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let vite;
let contracts;
let analyzeCreativeSeed;
let generateCharacterFromSeed;
let expandCharacter;
let generateConcepts;
let selectContextForField;
let createMockLLMClient;

const DETAILED_SEED = {
  text: "架空王城里，一位禁书库档案官与你签下限期婚约成为盟友，却必须在公开旧案真相和保护你重视的人之间选择。",
};

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  contracts = await vite.ssrLoadModule("/src/contracts.js");
  ({ analyzeCreativeSeed } = await vite.ssrLoadModule(
    "/src/generation/seed-analyzer.js",
  ));
  ({ generateCharacterFromSeed, expandCharacter } = await vite.ssrLoadModule(
    "/src/generation/character-generator.js",
  ));
  ({ generateConcepts } = await vite.ssrLoadModule(
    "/src/generation/concept-generator.js",
  ));
  ({ selectContextForField } = await vite.ssrLoadModule(
    "/src/generation/context-selector.js",
  ));
  ({ createMockLLMClient } = await vite.ssrLoadModule(
    "/src/mock/mock-llm-client.js",
  ));
});

after(async () => {
  await vite?.close();
});

function createCountingClient(delegate) {
  const requests = [];
  return {
    requests,
    client: {
      completeText(request) {
        return delegate.completeText(request);
      },
      completeJson(request) {
        requests.push(request);
        return delegate.completeJson(request);
      },
    },
  };
}

test("信息充分时不追问，且种子分析只调用模型一次", async () => {
  const counting = createCountingClient(createMockLLMClient());
  const result = await analyzeCreativeSeed(DETAILED_SEED, counting.client);

  assert.deepEqual(result, { questions: [] });
  assert.equal(counting.requests.length, 1);
  assert.equal(counting.requests[0].task, "seed-analysis");
});

test("信息不足时最多三问，每题都有 3—5 个选项和推荐值", async () => {
  const result = await analyzeCreativeSeed(
    { text: "想做一个冷淡但可靠的角色。" },
    createMockLLMClient(),
  );

  assert.equal(result.questions.length, 3);
  for (const question of result.questions) {
    assert.ok(question.options.length >= 3 && question.options.length <= 5);
    assert.ok(question.options.includes(question.recommended));
    assert.doesNotMatch(question.prompt, /生日|星座|发色/u);
  }
});

test("默认入口跳过全部答案也只生成一个完整角色", async () => {
  const counting = createCountingClient(createMockLLMClient());
  const result = await generateCharacterFromSeed(
    DETAILED_SEED,
    {},
    counting.client,
  );

  assert.equal(counting.requests.length, 1);
  assert.equal(counting.requests[0].task, "direct-character-generation");
  assert.equal(Object.hasOwn(result, "candidates"), false);
  assert.equal(typeof result.title, "string");
  contracts.assertCreativeBrief(result.brief);
  contracts.assertCharacterDraft(result.character);
  assert.equal(result.character.meta.name, result.character.publicInfo.name);
  assert.notEqual(result.character.meta.id, "character-shen-yanzhou");
  assert.notEqual(result.character.meta.createdAt, "2026-01-01T00:00:00.000Z");
});

test("模型返回的元数据与名称冲突会被本地权威值覆盖", async () => {
  const mock = createMockLLMClient();
  const response = await mock.completeJson({
    task: "direct-character-generation",
    messages: [],
  });
  response.character.meta = {
    id: "model-controlled-id",
    name: "模型中的另一名字",
    createdAt: "1900-01-01T00:00:00.000Z",
    updatedAt: "1900-01-01T00:00:00.000Z",
  };
  response.character.publicInfo.name = "林渡";

  let callCount = 0;
  const result = await generateCharacterFromSeed(DETAILED_SEED, {}, {
    async completeJson() {
      callCount += 1;
      return structuredClone(response);
    },
  });

  assert.equal(callCount, 1);
  assert.notEqual(result.character.meta.id, "model-controlled-id");
  assert.notEqual(result.character.meta.createdAt, "1900-01-01T00:00:00.000Z");
  assert.equal(result.character.meta.name, "林渡");
  assert.equal(result.character.publicInfo.name, "林渡");
  contracts.assertCharacterDraft(result.character);
});

test("旧三方向 API 保持正好三个候选，角色扩展元数据也由本地生成", async () => {
  const mock = createMockLLMClient();
  const direct = await generateCharacterFromSeed(DETAILED_SEED, {}, mock);
  const concepts = await generateConcepts(direct.brief, mock);

  assert.equal(concepts.length, 3);
  contracts.assertConceptCandidates(concepts);

  const expanded = await expandCharacter(concepts[0], direct.brief, mock);
  assert.notEqual(expanded.meta.id, "character-shen-yanzhou");
  assert.equal(expanded.meta.name, concepts[0].name);
  assert.equal(expanded.publicInfo.name, concepts[0].name);
  contracts.assertCharacterDraft(expanded);

  const taskAlias = await mock.completeJson({
    task: "three-direction-generation",
    messages: [],
  });
  assert.equal(taskAlias.length, 3);
});

test("字段上下文只携带相关世界、角色和关系字段且不修改项目", async () => {
  const direct = await generateCharacterFromSeed(
    DETAILED_SEED,
    {},
    createMockLLMClient(),
  );
  const project = {
    id: "UNRELATED_PROJECT_ID",
    title: direct.title,
    seed: DETAILED_SEED,
    brief: direct.brief,
    concepts: [],
    selectedConceptId: null,
    character: direct.character,
    worldBible: {
      summary: "王城议会与禁书库围绕旧案证据长期角力。",
      rules: ["旧案卷宗必须保留可追溯的誊写记录。"],
      locations: ["禁书库"],
      factions: ["王城议会"],
      canonFacts: ["议会即将销毁旧卷。"],
      forbiddenFacts: ["UNRELATED_WORLD_SECRET"],
    },
    storyDraft: { premise: "UNRELATED_STORY" },
    ruleReport: { status: "pass", issues: ["UNRELATED_REPORT"] },
    simulationReport: null,
    platformPacks: [{ text: "UNRELATED_PLATFORM_PACK" }],
    generationRecords: [{ target: "UNRELATED_HISTORY" }],
    createdAt: "UNRELATED_CREATED_AT",
    updatedAt: "UNRELATED_UPDATED_AT",
  };
  const snapshot = structuredClone(project);

  const context = selectContextForField(
    project,
    "dialogueStyle.sentenceStyle",
  );
  const serialized = JSON.stringify(context);

  assert.equal(
    context.character.dialogueStyle.sentenceStyle,
    direct.character.dialogueStyle.sentenceStyle,
  );
  assert.equal(Object.hasOwn(context.character, "openings"), false);
  assert.equal(Object.hasOwn(context.character, "imageDesign"), false);
  assert.doesNotMatch(serialized, /UNRELATED_PROJECT_ID|UNRELATED_STORY|UNRELATED_REPORT|UNRELATED_PLATFORM_PACK|UNRELATED_HISTORY/u);
  assert.deepEqual(project, snapshot);
  assert.notStrictEqual(context.character, project.character);
});
