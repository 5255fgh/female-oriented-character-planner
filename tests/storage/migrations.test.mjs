import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_APP_VERSION,
  migrateProjectJson,
} from "../../src/storage/migrations.js";
import {
  createLegacyCharacterProject,
  createProject,
  ISO_A,
} from "./fixtures.mjs";

test("旧裸 CharacterProject 纯迁移为 v2 ProjectDocument 信封", () => {
  const legacy = createLegacyCharacterProject();
  const before = structuredClone(legacy);

  const migrated = migrateProjectJson(legacy);

  assert.deepEqual(legacy, before);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.appVersion, CURRENT_APP_VERSION);
  assert.equal(migrated.exportedAt, ISO_A);
  assert.equal(migrated.project.id, legacy.id);
  assert.equal(migrated.project.seed, null);
  assert.equal(migrated.project.worldBible, null);
  assert.equal(migrated.project.storyDraft, null);
  assert.deepEqual(migrated.project.generationRecords, []);
});

test("v1 信封迁移为 v2 且不修改输入", () => {
  const input = {
    schemaVersion: 1,
    appVersion: "0.1.0",
    exportedAt: ISO_A,
    project: createProject({ seed: { text: "一句灵感" } }),
  };
  const before = structuredClone(input);

  const migrated = migrateProjectJson(input);

  assert.deepEqual(input, before);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.project.seed.text, "一句灵感");
});

test("未知高版本明确拒绝", () => {
  assert.throws(
    () =>
      migrateProjectJson({
        schemaVersion: 99,
        appVersion: "9.9.9",
        exportedAt: ISO_A,
        project: createProject(),
      }),
    /schemaVersion：99/,
  );
});
