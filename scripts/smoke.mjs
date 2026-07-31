import assert from "node:assert/strict";

async function runSmoke() {
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

try {
  await runSmoke();
  console.log("Smoke checks passed.");
} catch (error) {
  console.error("Smoke checks failed:", error);
  process.exitCode = 1;
}
