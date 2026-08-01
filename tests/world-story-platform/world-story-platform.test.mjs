import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let vite;
let contracts;
let createMockLLMClient;
let generateWorldBible;
let generateStoryDraft;
let createMaoxiangPack;
let validateMaoxiangFields;
let rulesModule;

before(async () => {
  vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  contracts = await vite.ssrLoadModule("/src/contracts.js");
  ({ createWorldStoryPlatformMockLLMClient: createMockLLMClient } =
    await vite.ssrLoadModule("/src/mock/world-story-platform-mock.js"));
  ({ generateWorldBible } = await vite.ssrLoadModule(
    "/src/generation/world-generator.js",
  ));
  ({ generateStoryDraft } = await vite.ssrLoadModule(
    "/src/generation/story-generator.js",
  ));
  ({ createMaoxiangPack } = await vite.ssrLoadModule(
    "/src/platforms/maoxiang/pack-generator.js",
  ));
  ({ validateMaoxiangFields } = await vite.ssrLoadModule(
    "/src/platforms/maoxiang/pack-validator.js",
  ));
  rulesModule = await vite.ssrLoadModule(
    "/src/platforms/maoxiang/rules.js",
  );
});

after(async () => {
  await vite?.close();
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createProject() {
  const client = createMockLLMClient();
  const [character, worldBible, storyDraft] = await Promise.all([
    client.completeJson({ task: "character-expansion", messages: [] }),
    client.completeJson({ task: "world-generation", messages: [] }),
    client.completeJson({ task: "story-generation", messages: [] }),
  ]);
  const timestamp = "2026-01-01T00:00:00.000Z";
  const project = {
    id: "project-world-story-platform",
    title: "雨夜卷宗",
    seed: { text: "在王城禁书库中，与契约盟友共同追查会动摇双方家族的旧案真相。" },
    brief: null,
    concepts: [],
    selectedConceptId: null,
    character,
    worldBible,
    storyDraft,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    generationRecords: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  contracts.assertProjectDocument(project);
  return project;
}

test("WorldBible 生成遵守世界条目上限并只重试一次", async () => {
  const baseClient = createMockLLMClient();
  const character = await baseClient.completeJson({
    task: "character-expansion",
    messages: [],
  });
  let calls = 0;
  const client = {
    async completeJson(request) {
      calls += 1;
      if (calls === 1) {
        return {
          summary: "无效世界",
          rules: Array.from({ length: 9 }, (_, index) => `规则 ${index + 1}`),
          locations: [],
          factions: [],
          canonFacts: [],
          forbiddenFacts: [],
        };
      }
      return baseClient.completeJson(request);
    },
  };

  const world = await generateWorldBible({ character }, client);
  contracts.assertWorldBible(world);
  assert.equal(calls, 2);
  assert.ok(world.rules.length <= 8);
  assert.ok(world.locations.length <= 5);
  assert.ok(world.factions.length <= 4);
  assert.notStrictEqual(world.canonFacts, world.forbiddenFacts);

  let invalidCalls = 0;
  await assert.rejects(
    generateWorldBible(
      { character },
      {
        async completeJson() {
          invalidCalls += 1;
          return null;
        },
      },
    ),
    /WorldBible/,
  );
  assert.equal(invalidCalls, 2, "空或无效 JSON 最多重试一次");
});

test("StoryDraft 支持角色、seed + world 和故事角色提取输入", async () => {
  const project = await createProject();
  const baseClient = createMockLLMClient();
  const fromCharacter = await generateStoryDraft(
    { character: project.character },
    baseClient,
  );
  const fromSeedAndWorld = await generateStoryDraft(
    { seed: project.seed, worldBible: project.worldBible },
    baseClient,
  );

  for (const story of [fromCharacter, fromSeedAndWorld]) {
    contracts.assertStoryDraft(story);
    assert.equal(story.keyNodes.length, 8);
    assert.ok(story.branches.length <= 4);
    assert.ok(story.foreshadowing.length <= 6);
    assert.ok(story.stateVariables.length <= 3);
  }

  let capturedRequest;
  await generateStoryDraft(
    { storyDraft: project.storyDraft },
    {
      async completeJson(request) {
        capturedRequest = request;
        return baseClient.completeJson(request);
      },
    },
  );
  const promptText = capturedRequest.messages
    .map((message) => message.content)
    .join("\n");
  assert.match(promptText, /从上下文提取出的主要角色生成输入/);
  assert.match(promptText, /沈砚舟/);
});

test("声明式规则完整记录来源与五种适配 flowId", () => {
  const expectedRuleKeys = [
    "allowedValues",
    "evidenceNote",
    "maxLength",
    "required",
    "verified",
    "verifiedAt",
  ];
  assert.deepEqual(rulesModule.MAOXIANG_ADAPTER_FLOW_IDS, [
    "editor_character",
    "free_character",
    "dead_rival",
    "image_shape",
    "editor_open_story",
  ]);
  for (const flowId of rulesModule.MAOXIANG_ADAPTER_FLOW_IDS) {
    for (const rule of Object.values(rulesModule.MAOXIANG_RULES[flowId])) {
      assert.deepEqual(Object.keys(rule).sort(), expectedRuleKeys);
      assert.equal(typeof rule.evidenceNote, "string");
    }
  }
  assert.equal(
    rulesModule.MAOXIANG_RULES.editor_character.roleName.maxLength,
    null,
  );
  assert.match(
    rulesModule.MAOXIANG_RULES.editor_open_story.storyPrompt.evidenceNote,
    /PROJECT_SPEC\.md/,
  );
});

test("统一验证处理必填、可选、Unicode、未知上限与枚举", () => {
  const rivalBlocks = validateMaoxiangFields("dead_rival", {
    rivalSetting: "   ",
    history: "有记录的历史",
    other: "",
  });
  assert.equal(rivalBlocks.find((block) => block.id === "rivalSetting").valid, false);
  assert.equal(rivalBlocks.find((block) => block.id === "other").valid, true);

  const withinLimit = validateMaoxiangFields("free_character", {
    characterPrompt: "😀".repeat(1000),
  })[0];
  assert.equal(withinLimit.currentLength, 1000);
  assert.equal(withinLimit.valid, true);

  const overLimit = validateMaoxiangFields("free_character", {
    characterPrompt: "😀".repeat(1001),
  })[0];
  assert.equal(overLimit.currentLength, 1001);
  assert.equal(overLimit.valid, false);

  const imageBlocks = validateMaoxiangFields("image_shape", {
    imagePrompt: "形".repeat(5000),
    styleSuggestion: "不存在的风格",
  });
  const imagePrompt = imageBlocks.find((block) => block.id === "imagePrompt");
  const style = imageBlocks.find((block) => block.id === "styleSuggestion");
  assert.equal(imagePrompt.maxLength, null);
  assert.equal(imagePrompt.verified, false);
  assert.equal(imagePrompt.valid, true, "未知上限不得产生臆测性失败");
  assert.equal(style.valid, false);
});

test("五种声明式适配器输出完整字段", async () => {
  const project = await createProject();
  const client = createMockLLMClient();
  const expectedFields = {
    editor_character: [
      "roleName",
      "roleIntroduction",
      "roleSetting",
      "sceneSetting",
      "openingMessage",
      "dialogueExamples",
      "imagePrompt",
      "voiceSuggestion",
    ],
    free_character: ["characterPrompt"],
    dead_rival: ["rivalSetting", "history", "other"],
    image_shape: ["imagePrompt", "styleSuggestion"],
    editor_open_story: [
      "storyTitle",
      "mainCharacters",
      "storyFoundation",
      "storyContent",
      "openingMessage",
      "chapterOutline",
      "storyPrompt",
    ],
  };

  for (const [flowId, fieldIds] of Object.entries(expectedFields)) {
    const pack = await createMaoxiangPack(project, flowId, client);
    assert.equal(pack.flowId, flowId);
    assert.deepEqual(
      pack.blocks.map((block) => block.id),
      fieldIds,
    );
  }
});

test("已知超限只压缩一次，仍超限时不截断并返回无效状态", async () => {
  const project = await createProject();
  project.character = clone(project.character);
  project.character.persona.background = "背景".repeat(1000);
  contracts.assertProjectDocument(project);

  const compressedButStillLong = `压缩尝试：${"字".repeat(1001)}`;
  let compressionCalls = 0;
  const pack = await createMaoxiangPack(
    project,
    "free_character",
    {
      async completeJson(request) {
        assert.equal(request.task, "maoxiang-compress-fields");
        compressionCalls += 1;
        return { characterPrompt: compressedButStillLong };
      },
    },
  );
  const block = pack.blocks[0];
  assert.equal(compressionCalls, 1);
  assert.equal(block.text, compressedButStillLong, "压缩结果必须完整保留，不能硬截断");
  assert.ok(block.currentLength > block.maxLength);
  assert.equal(block.valid, false);
});

test("未知上限字段不会触发自动压缩", async () => {
  const project = await createProject();
  project.character = clone(project.character);
  project.character.imageDesign.appearancePrompt = "形".repeat(5000);
  contracts.assertProjectDocument(project);

  let calls = 0;
  const pack = await createMaoxiangPack(
    project,
    "image_shape",
    {
      async completeJson() {
        calls += 1;
        throw new Error("未知上限不应请求压缩");
      },
    },
  );
  const imagePrompt = pack.blocks.find((block) => block.id === "imagePrompt");
  assert.equal(calls, 0);
  assert.equal(imagePrompt.maxLength, null);
  assert.equal(imagePrompt.currentLength, 5000);
  assert.equal(imagePrompt.valid, true);
});
