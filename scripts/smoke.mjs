import assert from "node:assert/strict";
import { createServer } from "vite";

const IMAGE_STYLES = ["通用", "像素画", "言情漫画", "细腻厚涂"];

async function runContractAndMockSmoke() {
  const contracts = await import("../src/contracts.js");
  const { createMockLLMClient } = await import(
    "../src/mock/mock-llm-client.js"
  );

  assert.equal(
    typeof contracts.assertConceptCandidates,
    "function",
    "contracts.js 应可导入",
  );
  assert.equal(
    typeof contracts.applyFieldPatch,
    "function",
    "contracts.js 应导出 applyFieldPatch",
  );

  const client = createMockLLMClient();
  assert.equal(typeof client.completeJson, "function", "mock client 应可创建");
  assert.equal(typeof client.completeText, "function", "mock client 应实现 completeText");

  const concepts = await client.completeJson({
    task: "concept-generation",
    messages: [],
  });
  contracts.assertConceptCandidates(concepts);
  assert.equal(concepts.length, 3, "mock 概念必须正好返回 3 个");

  const character = await client.completeJson({
    task: "character-expansion",
    messages: [],
  });
  contracts.assertCharacterDraft(character);
  const characterWithCustomStyle = structuredClone(character);
  characterWithCustomStyle.imageDesign.styleSuggestion = "水彩";
  assert.doesNotThrow(
    () => contracts.assertCharacterDraft(characterWithCustomStyle),
    "角色草稿中的画风建议应允许任意字符串",
  );

  const fieldPatch = await client.completeJson({
    task: "field-regeneration",
    messages: [],
  });
  contracts.assertFieldPatch(fieldPatch);

  const simulation = await client.completeJson({
    task: "dialogue-evaluation",
    messages: [],
  });
  contracts.assertSimulationReport(simulation);
  assert.equal(
    simulation.scenarios.length,
    8,
    "mock 模拟测试必须正好返回 8 个场景",
  );

  const freeCharacterPack = await client.completeJson({
    task: "maoxiang-free-character",
    messages: [],
  });
  contracts.assertPlatformPack(freeCharacterPack);
  const characterPrompt = freeCharacterPack.blocks.find(
    (block) => block.id === "characterPrompt",
  );
  assert.ok(characterPrompt, "自由创建包必须包含 characterPrompt");
  assert.ok(
    contracts.countUnicodeCharacters(characterPrompt.text) <= 1000,
    "characterPrompt 不得超过 1000 字",
  );
  const inconsistentPack = structuredClone(freeCharacterPack);
  inconsistentPack.blocks[0].text = "字".repeat(1001);
  inconsistentPack.blocks[0].currentLength = 1001;
  assert.throws(
    () => contracts.assertPlatformPack(inconsistentPack),
    /PlatformPack\.blocks\[0\]\.valid/,
    "超长文本不能继续标记为有效",
  );

  const unsafeFlowPack = structuredClone(freeCharacterPack);
  unsafeFlowPack.flowId = "constructor";
  assert.throws(
    () => contracts.assertPlatformPack(unsafeFlowPack),
    /PlatformPack\.flowId/,
    "flowId 只能使用已知入口且不得读取对象原型链",
  );

  const deadRivalPack = await client.completeJson({
    task: "maoxiang-dead-rival",
    messages: [],
  });
  contracts.assertPlatformPack(deadRivalPack);
  const rivalSetting = deadRivalPack.blocks.find(
    (block) => block.id === "rivalSetting",
  );
  assert.ok(rivalSetting, "亡者劲敌包必须包含 rivalSetting");
  assert.ok(
    contracts.countUnicodeCharacters(rivalSetting.text) <= 300,
    "rivalSetting 不得超过 300 字",
  );

  const imageShapePack = await client.completeJson({
    task: "maoxiang-image-shape",
    messages: [],
  });
  contracts.assertPlatformPack(imageShapePack);

  const original = {
    publicInfo: { name: "原始名称", tags: ["克制"] },
  };
  const snapshot = structuredClone(original);
  const patched = contracts.applyFieldPatch(original, {
    fieldPath: "publicInfo.name",
    value: "更新名称",
  });
  assert.deepEqual(original, snapshot, "applyFieldPatch 不得修改原对象");
  assert.notStrictEqual(patched, original, "applyFieldPatch 必须返回深拷贝");
  assert.equal(patched.publicInfo.name, "更新名称");

  assert.throws(
    () => contracts.getValueAtPath(original, "publicInfo.tags[0]"),
    /fieldPath|publicInfo\.tags\[0\]/,
    "字段路径只允许点分隔格式",
  );
}

async function runBusinessFlowSmoke() {
  const vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    // 通过 Vite SSR 加载，确保业务模块中的 Markdown ?raw 导入真实可用。
    const contracts = await vite.ssrLoadModule("/src/contracts.js");
    const { createEmptyBrief } = await vite.ssrLoadModule("/src/app-state.js");
    const { createMockLLMClient } = await vite.ssrLoadModule(
      "/src/mock/mock-llm-client.js",
    );
    const { generateConcepts } = await vite.ssrLoadModule(
      "/src/generation/concept-generator.js",
    );
    const { expandCharacter } = await vite.ssrLoadModule(
      "/src/generation/character-generator.js",
    );
    const { regenerateField } = await vite.ssrLoadModule(
      "/src/generation/field-regenerator.js",
    );
    const { checkRules } = await vite.ssrLoadModule(
      "/src/evaluation/rule-checker.js",
    );
    const { runDialogueTest } = await vite.ssrLoadModule(
      "/src/evaluation/dialogue-tester.js",
    );
    const { generateMaoxiangPack } = await vite.ssrLoadModule(
      "/src/platforms/maoxiang/pack-generator.js",
    );
    const { validatePlatformPack } = await vite.ssrLoadModule(
      "/src/platforms/maoxiang/pack-validator.js",
    );

    const brief = {
      ...createEmptyBrief(),
      characterGender: "女",
      ageRange: "25-30",
      worldSetting: "现代都市",
      characterIdentity: "调查记者",
      coreExperiences: ["追查旧案"],
      relationshipType: "宿敌转盟友",
      coreConflict: "真相与信任",
      personalityContradiction: "冷静但心软",
      initiativeLevel: "high",
      interactionTone: ["克制", "有行动力"],
      boundaries: ["尊重拒绝"],
      bannedBehaviors: ["替用户决定"],
      extraNotes: "Mock 全流程验收",
    };
    contracts.assertCreativeBrief(brief);

    const client = createMockLLMClient();
    const concepts = await generateConcepts(brief, client);
    assert.equal(concepts.length, 3, "业务接口必须生成正好 3 个候选");

    const originalCharacter = await expandCharacter(concepts[0], brief, client);
    const fieldPath = "persona.background";
    const patch = await regenerateField(
      originalCharacter,
      fieldPath,
      "增加旧案细节",
      client,
    );
    assert.equal(patch.fieldPath, fieldPath, "字段重生成不得改写请求路径");
    const character = contracts.applyFieldPatch(originalCharacter, patch);
    assert.notDeepEqual(
      contracts.getValueAtPath(character, fieldPath),
      contracts.getValueAtPath(originalCharacter, fieldPath),
      "字段重生成应产生实际变化",
    );
    const revertedCharacter = contracts.applyFieldPatch(character, {
      fieldPath,
      value: contracts.getValueAtPath(originalCharacter, fieldPath),
    });
    assert.deepEqual(
      revertedCharacter,
      originalCharacter,
      "单字段重生成只能改变一个字段路径",
    );

    const ruleReport = checkRules(character);
    contracts.assertRuleCheckReport(ruleReport);

    const simulationReport = await runDialogueTest(character, client);
    contracts.assertSimulationReport(simulationReport);
    assert.equal(
      simulationReport.scenarios.length,
      8,
      "业务接口必须运行正好 8 个场景",
    );

    const freeCharacterPack = await generateMaoxiangPack(
      character,
      "free_character",
      client,
    );
    const characterPrompt = freeCharacterPack.blocks.find(
      (block) => block.id === "characterPrompt",
    );
    assert.ok(characterPrompt, "free_character 必须包含 characterPrompt");
    assert.ok(characterPrompt.currentLength <= 1000, "characterPrompt 不得超过 1000 字");

    const deadRivalPack = await generateMaoxiangPack(
      character,
      "dead_rival",
      client,
    );
    const rivalSetting = deadRivalPack.blocks.find(
      (block) => block.id === "rivalSetting",
    );
    assert.ok(rivalSetting, "dead_rival 必须包含 rivalSetting");
    assert.ok(rivalSetting.currentLength <= 300, "rivalSetting 不得超过 300 字");
    for (const blockId of ["history", "other"]) {
      assert.equal(
        deadRivalPack.blocks.find((block) => block.id === blockId)?.maxLength,
        null,
        `${blockId} 的未知上限必须保持 null`,
      );
    }

    const imageShapePack = await generateMaoxiangPack(
      character,
      "image_shape",
      client,
    );
    const imagePrompt = imageShapePack.blocks.find(
      (block) => block.id === "imagePrompt",
    );
    const styleSuggestion = imageShapePack.blocks.find(
      (block) => block.id === "styleSuggestion",
    );
    assert.equal(imagePrompt?.maxLength, null, "imagePrompt 的未知上限必须保持 null");
    assert.ok(
      IMAGE_STYLES.includes(styleSuggestion?.text),
      "styleSuggestion 必须属于四个允许值",
    );

    const overLimitText = "字".repeat(1001);
    const editedPack = validatePlatformPack({
      ...freeCharacterPack,
      blocks: freeCharacterPack.blocks.map((block) =>
        block.id === "characterPrompt"
          ? {
              ...block,
              text: overLimitText,
              currentLength: 1001,
              valid: false,
            }
          : block,
      ),
    });
    assert.equal(
      editedPack.blocks[0].text,
      overLimitText,
      "超限输入只能标记，不能 substring 截断",
    );
    assert.equal(editedPack.blocks[0].valid, false, "超限输入必须标记为无效");

    const timestamp = new Date().toISOString();
    contracts.assertCharacterProject({
      id: "project-smoke",
      title: "Mock 全流程",
      brief,
      concepts,
      selectedConceptId: concepts[0].id,
      character,
      ruleReport,
      simulationReport,
      platformPacks: [freeCharacterPack, deadRivalPack, imageShapePack],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } finally {
    await vite.close();
  }
}

async function runLLMClientSmoke() {
  const { createLLMClient } = await import(
    "../src/llm/openai-compatible-client.js"
  );
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const requestBodies = [];

  globalThis.fetch = async (_url, options) => {
    callCount += 1;
    requestBodies.push(JSON.parse(options.body));
    const content = callCount === 1
      ? "```json\n{\"ok\":true}\n```"
      : "{\"ok\":true}";
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async text() {
        return JSON.stringify({ choices: [{ message: { content } }] });
      },
    };
  };

  try {
    const client = createLLMClient({
      endpoint: "https://example.invalid/chat/completions",
      model: "smoke-model",
    });
    const result = await client.completeJson({
      task: "raw-json-smoke",
      messages: [{ role: "user", content: "只返回原始 JSON" }],
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(callCount, 2, "无效 JSON 最多只重试一次");
    assert.equal(
      requestBodies[1].messages.length,
      2,
      "Markdown 围栏必须视为无效并追加一次纠正消息",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function runSmoke() {
  await runContractAndMockSmoke();
  await runBusinessFlowSmoke();
  await runLLMClientSmoke();
}

try {
  await runSmoke();
  console.log("Smoke checks passed.");
} catch (error) {
  console.error("Smoke checks failed:", error);
  process.exitCode = 1;
}
