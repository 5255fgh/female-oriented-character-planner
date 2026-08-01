import assert from "node:assert/strict";
import { createServer } from "vite";

import { createFakeIndexedDB } from "../../tests/storage/fake-indexeddb.mjs";

const CORE_SEED = {
  text: "架空王城中，禁书库档案官与没落家族继承人以限期契约结盟，共同追查会动摇双方家族的旧案真相。",
};

export async function runCoreFlowSmoke() {
  const hadIndexedDB = Object.prototype.hasOwnProperty.call(
    globalThis,
    "indexedDB",
  );
  const originalIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = createFakeIndexedDB();

  const vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    const contracts = await vite.ssrLoadModule("/src/contracts.js");
    const generation = await vite.ssrLoadModule("/src/generation/index.js");
    const evaluation = await vite.ssrLoadModule("/src/evaluation/index.js");
    const platform = await vite.ssrLoadModule(
      "/src/platforms/maoxiang/index.js",
    );
    const storage = await vite.ssrLoadModule("/src/storage/index.js");
    const workflow = await vite.ssrLoadModule("/src/workflow/index.js");
    const mocks = await vite.ssrLoadModule("/src/mock/index.js");

    const llmClient = mocks.createCoreFlowMockLLMClient();
    const generated = await generation.generateCharacterFromSeed(
      CORE_SEED,
      {},
      llmClient,
    );
    contracts.assertCreativeBrief(generated.brief);
    contracts.assertCharacterDraft(generated.character);

    const worldBible = await generation.generateWorldBible(
      {
        seed: CORE_SEED,
        brief: generated.brief,
        character: generated.character,
      },
      llmClient,
    );
    const storyDraft = await generation.generateStoryDraft(
      {
        seed: CORE_SEED,
        brief: generated.brief,
        character: generated.character,
        worldBible,
      },
      llmClient,
    );

    const ruleReport = evaluation.checkRules(generated.character);
    const quickDialogueReport = await evaluation.runQuickDialogueTest(
      generated.character,
      llmClient,
    );
    assert.equal(
      quickDialogueReport.scenarios.length,
      3,
      "快速评估必须返回正好三个瞬时场景",
    );

    const timestamp = new Date().toISOString();
    let project = {
      id: contracts.createId("project"),
      title: generated.title,
      seed: CORE_SEED,
      brief: generated.brief,
      concepts: [],
      selectedConceptId: null,
      character: generated.character,
      worldBible,
      storyDraft,
      ruleReport,
      simulationReport: null,
      platformPacks: [],
      generationRecords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    contracts.assertProjectDocument(project);

    const characterPack = await platform.createMaoxiangPack(
      project,
      "editor_character",
      llmClient,
    );
    const storyPack = await platform.createMaoxiangPack(
      project,
      "editor_open_story",
      llmClient,
    );
    project = {
      ...project,
      platformPacks: [characterPack, storyPack],
    };
    contracts.assertProjectDocument(project);
    assert.deepEqual(
      project.platformPacks.map((pack) => pack.flowId),
      ["editor_character", "editor_open_story"],
      "角色与故事项目都必须能生成并持久化平台包",
    );

    const status = workflow.deriveProjectStatus(project);
    assert.equal(status.completed.character, true);
    assert.equal(status.completed.world, true);
    assert.equal(status.completed.story, true);
    assert.equal(status.completed.output, true);
    assert.equal(
      status.completed.evaluation,
      false,
      "三场景快速报告不得伪装成持久化的八场景完整评估",
    );

    const saved = await storage.saveProject(project);
    const exported = await storage.exportProjectJson(saved.id);
    const envelope = JSON.parse(exported);
    assert.equal(envelope.schemaVersion, 2);
    const imported = await storage.importProjectJson(exported);
    contracts.assertProjectDocument(imported);
    assert.notEqual(imported.id, saved.id, "导入项目必须生成新 ID");
    assert.deepEqual(imported.character, saved.character);
    assert.deepEqual(imported.worldBible, saved.worldBible);
    assert.deepEqual(imported.storyDraft, saved.storyDraft);
    assert.deepEqual(imported.platformPacks, saved.platformPacks);

    const invalidated = workflow.invalidateProject(imported, "character");
    contracts.assertProjectDocument(invalidated);
    assert.deepEqual(invalidated.worldBible, imported.worldBible);
    assert.equal(invalidated.storyDraft, null);
    assert.equal(invalidated.ruleReport, null);
    assert.equal(invalidated.simulationReport, null);
    assert.deepEqual(invalidated.platformPacks, []);
  } finally {
    await vite.close();
    if (hadIndexedDB) {
      globalThis.indexedDB = originalIndexedDB;
    } else {
      delete globalThis.indexedDB;
    }
  }
}
