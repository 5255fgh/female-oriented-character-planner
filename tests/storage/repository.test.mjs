import assert from "node:assert/strict";
import test from "node:test";

import {
  DATABASE_NAME,
  DATABASE_VERSION,
  openDatabase,
  transactionDone,
} from "../../src/storage/indexeddb.js";
import {
  exportProjectJson,
  exportProjectMarkdown,
  importProjectJson,
} from "../../src/storage/exporters.js";
import {
  deleteProject,
  getProject,
  listProjects,
  listVersions,
  restoreVersion,
  saveProject,
  saveVersion,
} from "../../src/storage/repository.js";
import {
  createCharacter,
  createBrief,
  createConcepts,
  createLegacyCharacterProject,
  createProject,
  createRuleReport,
  createSimulationReport,
  createStory,
  ISO_A,
} from "./fixtures.mjs";
import {
  createFakeIndexedDB,
  requestResult,
  transactionResult,
} from "./fake-indexeddb.mjs";

function resetDatabase() {
  globalThis.indexedDB = createFakeIndexedDB();
}

for (const [name, project] of [
  ["只有 seed", createProject({ seed: { text: "雨夜重逢" } })],
  ["角色中间", createProject({ character: createCharacter() })],
  ["故事中间", createProject({ storyDraft: createStory() })],
]) {
  test(`${name}项目可以保存和恢复`, async () => {
    resetDatabase();

    const saved = await saveProject(project);
    const restored = await getProject(project.id);

    assert.deepEqual(restored, saved);
    assert.deepEqual((await listProjects()).map((value) => value.id), [project.id]);
  });
}

test("完整 ProjectDocument 仍可保存和恢复", async () => {
  resetDatabase();
  const concepts = createConcepts();
  const project = createProject({
    seed: { text: "完整项目" },
    brief: createBrief(),
    concepts,
    selectedConceptId: concepts[0].id,
    character: createCharacter(),
    storyDraft: createStory(),
    ruleReport: createRuleReport(),
    simulationReport: createSimulationReport(),
  });

  const saved = await saveProject(project);

  assert.deepEqual(await getProject(saved.id), saved);
});

test("普通 saveProject 不生成历史，显式版本最多保留 20 个", async () => {
  resetDatabase();
  const project = await saveProject(createProject());
  assert.deepEqual(await listVersions(project.id), []);

  for (let index = 0; index < 21; index += 1) {
    await saveVersion(project.id, { ...project, title: `版本${index + 1}` });
  }

  const versions = await listVersions(project.id);
  assert.equal(versions.length, 20);
  assert.ok(versions.every((version) => version.projectId === project.id));
});

test("恢复版本会把恢复后的状态写成一个新版本", async () => {
  resetDatabase();
  const original = await saveProject(createProject({ title: "原始标题" }));
  const version = await saveVersion(original.id, original);
  await saveProject({ ...original, title: "修改后标题" });

  const restored = await restoreVersion(original.id, version.id);

  assert.equal(restored.title, "原始标题");
  assert.equal((await listVersions(original.id)).length, 2);
});

test("删除项目会同时删除所属历史版本", async () => {
  resetDatabase();
  const project = await saveProject(createProject());
  await saveVersion(project.id, project);

  await deleteProject(project.id);

  assert.equal(await getProject(project.id), null);
  assert.deepEqual(await listVersions(project.id), []);
});

test("JSON 导出使用 v2 信封，旧 JSON 导入后生成新项目 ID", async () => {
  resetDatabase();
  const saved = await saveProject(createProject({ seed: { text: "导出测试" } }));
  const envelope = JSON.parse(await exportProjectJson(saved.id));
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.appVersion, "0.2.0");
  assert.equal(envelope.project.id, saved.id);

  const legacy = createLegacyCharacterProject();
  const imported = await importProjectJson(JSON.stringify(legacy));
  assert.notEqual(imported.id, legacy.id);
  assert.equal(imported.seed, null);
  assert.equal(imported.worldBible, null);
  assert.equal(imported.storyDraft, null);
  assert.deepEqual(await getProject(imported.id), imported);
});

test("Markdown 导出呈现 seed 和故事阶段内容", async () => {
  resetDatabase();
  const saved = await saveProject(
    createProject({
      seed: { text: "雨夜灵感" },
      storyDraft: createStory(),
    }),
  );

  const markdown = await exportProjectMarkdown(saved.id);

  assert.match(markdown, /## 创意种子\n\n雨夜灵感/);
  assert.match(markdown, /## 故事草稿/);
  assert.match(markdown, /雨夜旧案/);
});

test("未知 JSON 版本和迁移失败都不会写数据库", async () => {
  resetDatabase();

  await assert.rejects(
    importProjectJson(
      JSON.stringify({
        schemaVersion: 99,
        appVersion: "9.9.9",
        exportedAt: ISO_A,
        project: createProject(),
      }),
    ),
    /schemaVersion：99/,
  );
  await assert.rejects(
    importProjectJson(JSON.stringify({ schemaVersion: 1, project: { bad: true } })),
  );

  assert.deepEqual(await listProjects(), []);
});

test("契约外敏感字段在打开数据库前即被拒绝", async () => {
  resetDatabase();
  await assert.rejects(
    saveProject({ ...createProject(), apiKey: "redacted" }),
    /apiKey: unexpected field/,
  );
  assert.deepEqual(await listProjects(), []);
});

test("事务中止不会返回成功结果", async () => {
  resetDatabase();
  const database = await openDatabase();
  const transaction = database.transaction("projects", "readwrite");
  const done = transactionDone(transaction);
  transaction.abort();

  await assert.rejects(done, /事务失败/);
  database.close();
});

test("数据库从 v1 升级到 v2 时保留并迁移旧项目和版本", async () => {
  resetDatabase();
  const legacy = createLegacyCharacterProject();
  const openRequest = globalThis.indexedDB.open(DATABASE_NAME, 1);
  openRequest.addEventListener("upgradeneeded", () => {
    const database = openRequest.result;
    const projects = database.createObjectStore("projects", { keyPath: "id" });
    projects.createIndex("updatedAt", "updatedAt", { unique: false });
    const versions = database.createObjectStore("versions", { keyPath: "id" });
    versions.createIndex("projectId", "projectId", { unique: false });
    versions.createIndex("createdAt", "createdAt", { unique: false });
  });
  const legacyDatabase = await requestResult(openRequest);
  const legacyTransaction = legacyDatabase.transaction(
    ["projects", "versions"],
    "readwrite",
  );
  const legacyDone = transactionResult(legacyTransaction);
  legacyTransaction.objectStore("projects").put(legacy);
  legacyTransaction.objectStore("versions").put({
    id: "legacy-version",
    projectId: legacy.id,
    snapshot: legacy,
    createdAt: ISO_A,
  });
  await legacyDone;
  legacyDatabase.close();

  const upgraded = await openDatabase();
  assert.equal(upgraded.version, DATABASE_VERSION);
  const inspectTransaction = upgraded.transaction("versions", "readonly");
  assert.equal(
    inspectTransaction
      .objectStore("versions")
      .indexNames.contains("projectIdCreatedAt"),
    true,
  );
  upgraded.close();

  const project = await getProject(legacy.id);
  assert.equal(project.seed, null);
  assert.deepEqual(project.generationRecords, []);
  const versions = await listVersions(legacy.id);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].snapshot.storyDraft, null);
});
