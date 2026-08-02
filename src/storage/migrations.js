import {
  assertCharacterProject,
  assertProjectDocument,
} from "../contracts.js";
import { deepClone } from "./clone.js";

export const CURRENT_SCHEMA_VERSION = 2;
export const CURRENT_APP_VERSION = "0.2.0";

const V2_ENVELOPE_KEYS = [
  "schemaVersion",
  "appVersion",
  "exportedAt",
  "project",
];
const V1_ENVELOPE_KEYS = new Set(V2_ENVELOPE_KEYS);

function assertRecord(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path}: expected an object`);
  }
  return value;
}

function assertNoUnexpectedKeys(value, allowedKeys, path) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${path}.${key}: unexpected field`);
    }
  }
}

function assertExactKeys(value, expectedKeys, path) {
  const allowedKeys = new Set(expectedKeys);
  assertNoUnexpectedKeys(value, allowedKeys, path);
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${path}.${key}: missing field`);
    }
  }
}

function assertSchemaVersion(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${path}: expected a positive integer`);
  }
  return value;
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

function assertIsoTimestamp(value, path) {
  const timestamp = assertNonEmptyString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${path}: expected an ISO timestamp`);
  }
  return timestamp;
}

/**
 * 将旧的完整 CharacterProject 补齐为可分阶段保存的 ProjectDocument。
 *
 * @param {unknown} value
 * @returns {import("../contracts/project.js").ProjectDocument}
 */
export function migrateLegacyCharacterProject(value) {
  const legacy = assertCharacterProject(value);
  const project = {
    id: legacy.id,
    title: legacy.title,
    seed: null,
    brief: deepClone(legacy.brief),
    concepts: deepClone(legacy.concepts),
    selectedConceptId: legacy.selectedConceptId,
    character: deepClone(legacy.character),
    worldBible: null,
    storyDraft: null,
    ruleReport: deepClone(legacy.ruleReport),
    simulationReport: deepClone(legacy.simulationReport),
    platformPacks: deepClone(legacy.platformPacks),
    generationRecords: [],
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
  assertProjectDocument(project);
  return deepClone(project);
}

/**
 * 迁移数据库里可能仍是旧 CharacterProject 的项目记录。
 * 此函数不读取时间、不生成 ID，也不修改输入。
 *
 * @param {unknown} value
 * @returns {import("../contracts/project.js").ProjectDocument}
 */
export function migrateStoredProject(value) {
  try {
    assertProjectDocument(value);
    return deepClone(value);
  } catch (projectError) {
    try {
      return migrateLegacyCharacterProject(value);
    } catch {
      throw projectError;
    }
  }
}

function exportedAtFromProject(project) {
  return assertIsoTimestamp(project.updatedAt, "ProjectDocument.updatedAt");
}

function migrateV1Envelope(envelope) {
  assertNoUnexpectedKeys(envelope, V1_ENVELOPE_KEYS, "ProjectExport");
  if (!Object.prototype.hasOwnProperty.call(envelope, "project")) {
    throw new Error("ProjectExport.project: missing field");
  }

  const project = migrateStoredProject(envelope.project);
  const exportedAt = Object.prototype.hasOwnProperty.call(envelope, "exportedAt")
    ? assertIsoTimestamp(envelope.exportedAt, "ProjectExport.exportedAt")
    : exportedAtFromProject(project);

  if (Object.prototype.hasOwnProperty.call(envelope, "appVersion")) {
    assertNonEmptyString(envelope.appVersion, "ProjectExport.appVersion");
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: CURRENT_APP_VERSION,
    exportedAt,
    project,
  };
}

function validateV2Envelope(envelope) {
  assertExactKeys(envelope, V2_ENVELOPE_KEYS, "ProjectExport");
  assertNonEmptyString(envelope.appVersion, "ProjectExport.appVersion");
  assertIsoTimestamp(envelope.exportedAt, "ProjectExport.exportedAt");
  assertProjectDocument(envelope.project);
  return deepClone(envelope);
}

/**
 * 将已解析 JSON 纯函数迁移为当前 v2 导出信封。
 *
 * 支持旧裸 CharacterProject、v1 信封和当前 v2 信封；未知高版本明确拒绝。
 *
 * @param {unknown} value
 * @returns {{schemaVersion: 2, appVersion: string, exportedAt: string, project: import("../contracts/project.js").ProjectDocument}}
 */
export function migrateProjectJson(value) {
  const input = assertRecord(value, "ProjectExport");
  if (!Object.prototype.hasOwnProperty.call(input, "schemaVersion")) {
    const project = migrateLegacyCharacterProject(input);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: CURRENT_APP_VERSION,
      exportedAt: exportedAtFromProject(project),
      project,
    };
  }

  const schemaVersion = assertSchemaVersion(
    input.schemaVersion,
    "ProjectExport.schemaVersion",
  );
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`不支持的项目 JSON schemaVersion：${schemaVersion}`);
  }
  if (schemaVersion === 1) {
    return migrateV1Envelope(input);
  }
  return validateV2Envelope(input);
}
