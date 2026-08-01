import {
  applyFieldPatch,
  assertCharacterDraft,
  assertProjectDocument,
  getValueAtPath,
} from "../contracts.js";
import {
  assertJsonValue,
  cloneJsonValue,
} from "../contracts/common.js";
import { invalidateProject } from "../workflow/invalidation.js";

export const MAX_REVISION_HISTORY = 20;

const REVISION_KEYS = ["fieldPath", "before", "after", "summary"];
const HISTORY_ENTRY_KEYS = ["fieldPath", "before", "after", "appliedAt"];
const SYSTEM_MANAGED_PATHS = new Set([
  "meta",
  "meta.id",
  "meta.createdAt",
  "meta.updatedAt",
]);

/**
 * @typedef {import("../contracts/common.js").JsonValue} JsonValue
 * @typedef {{fieldPath: string, before: JsonValue, after: JsonValue, summary: string}} FieldRevision
 * @typedef {{fieldPath: string, before: JsonValue, after: JsonValue, appliedAt: string}} RevisionHistoryEntry
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} value
 * @param {string[]} expectedKeys
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function assertExactObject(value, expectedKeys, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: expected an object`);
  }
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${path}.${key}: missing required field`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.includes(key)) {
      throw new Error(`${path}.${key}: unexpected field`);
    }
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {{nonEmpty?: boolean}} [options]
 * @returns {string}
 */
function assertString(value, path, options = {}) {
  if (typeof value !== "string") {
    throw new Error(`${path}: expected a string`);
  }
  if (options.nonEmpty && value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

/**
 * @param {JsonValue} left
 * @param {JsonValue} right
 * @returns {boolean}
 */
function areJsonValuesEqual(left, right) {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => areJsonValuesEqual(item, right[index]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false;
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (
      leftKeys.length !== rightKeys.length ||
      leftKeys.some((key, index) => key !== rightKeys[index])
    ) {
      return false;
    }
    return leftKeys.every((key) =>
      areJsonValuesEqual(
        /** @type {JsonValue} */ (left[key]),
        /** @type {JsonValue} */ (right[key]),
      ));
  }
  return false;
}

/**
 * @param {import("../contracts.js").CharacterDraft} character
 * @param {unknown} fieldPath
 * @returns {JsonValue}
 */
function getEditableValue(character, fieldPath) {
  const path = assertString(fieldPath, "revision.fieldPath", { nonEmpty: true });
  if (SYSTEM_MANAGED_PATHS.has(path)) {
    throw new Error(`revision.fieldPath: ${path} is managed by the application`);
  }
  const value = getValueAtPath(character, path);
  assertJsonValue(value, `CharacterDraft.${path}`);
  return /** @type {JsonValue} */ (value);
}

/**
 * 校验提案只作用于当前角色的一个已有字段，并用完整角色契约校验新值类型。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {unknown} revision
 * @returns {FieldRevision}
 */
export function assertRevisionForProject(project, revision) {
  assertProjectDocument(project);
  if (project.character === null) {
    throw new Error("project.character: expected a generated character");
  }

  const revisionObject = assertExactObject(revision, REVISION_KEYS, "revision");
  const fieldPath = assertString(revisionObject.fieldPath, "revision.fieldPath", {
    nonEmpty: true,
  });
  assertJsonValue(revisionObject.before, "revision.before");
  assertJsonValue(revisionObject.after, "revision.after");
  assertString(revisionObject.summary, "revision.summary", { nonEmpty: true });

  const currentValue = getEditableValue(project.character, fieldPath);
  const before = /** @type {JsonValue} */ (revisionObject.before);
  const after = /** @type {JsonValue} */ (revisionObject.after);
  if (!areJsonValuesEqual(currentValue, before)) {
    throw new Error("revision.before: expected the current field value");
  }
  if (areJsonValuesEqual(before, after)) {
    throw new Error("revision.after: expected a value different from revision.before");
  }

  const patchedCharacter = applyFieldPatch(project.character, {
    fieldPath,
    value: after,
  });
  try {
    assertCharacterDraft(patchedCharacter);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`revision.after: value does not preserve the field type; ${reason}`);
  }

  return /** @type {FieldRevision} */ (revision);
}

/**
 * @param {string} before
 * @param {string} after
 * @param {string} path
 * @returns {Array<Record<string, unknown>>}
 */
function createTextChanges(before, after, path) {
  const beforeCharacters = Array.from(before);
  const afterCharacters = Array.from(after);
  let prefixLength = 0;
  while (
    prefixLength < beforeCharacters.length &&
    prefixLength < afterCharacters.length &&
    beforeCharacters[prefixLength] === afterCharacters[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < beforeCharacters.length - prefixLength &&
    suffixLength < afterCharacters.length - prefixLength &&
    beforeCharacters[beforeCharacters.length - 1 - suffixLength] ===
      afterCharacters[afterCharacters.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const changes = [];
  const prefix = beforeCharacters.slice(0, prefixLength).join("");
  const removed = beforeCharacters
    .slice(prefixLength, beforeCharacters.length - suffixLength)
    .join("");
  const added = afterCharacters
    .slice(prefixLength, afterCharacters.length - suffixLength)
    .join("");
  const suffix = suffixLength === 0
    ? ""
    : beforeCharacters.slice(beforeCharacters.length - suffixLength).join("");
  if (prefix.length > 0) changes.push({ type: "equal", path, value: prefix });
  if (removed.length > 0) changes.push({ type: "remove", path, value: removed });
  if (added.length > 0) changes.push({ type: "add", path, value: added });
  if (suffix.length > 0) changes.push({ type: "equal", path, value: suffix });
  return changes;
}

/**
 * @param {JsonValue[]} before
 * @param {JsonValue[]} after
 * @param {string} path
 * @returns {Array<Record<string, unknown>>}
 */
function createArrayChanges(before, after, path) {
  if (before.length * after.length > 40_000) {
    return [
      { type: "remove", path, value: cloneJsonValue(before) },
      { type: "add", path, value: cloneJsonValue(after) },
    ];
  }

  const lengths = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );
  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      lengths[beforeIndex][afterIndex] = areJsonValuesEqual(
        before[beforeIndex],
        after[afterIndex],
      )
        ? lengths[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(
            lengths[beforeIndex + 1][afterIndex],
            lengths[beforeIndex][afterIndex + 1],
          );
    }
  }

  const changes = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (
      beforeIndex < before.length &&
      afterIndex < after.length &&
      areJsonValuesEqual(before[beforeIndex], after[afterIndex])
    ) {
      changes.push({
        type: "equal",
        path: `${path}[${afterIndex}]`,
        beforeIndex,
        afterIndex,
        value: cloneJsonValue(before[beforeIndex]),
      });
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      beforeIndex < before.length &&
      (afterIndex >= after.length ||
        lengths[beforeIndex + 1][afterIndex] >= lengths[beforeIndex][afterIndex + 1])
    ) {
      changes.push({
        type: "remove",
        path: `${path}[${beforeIndex}]`,
        beforeIndex,
        value: cloneJsonValue(before[beforeIndex]),
      });
      beforeIndex += 1;
    } else {
      changes.push({
        type: "add",
        path: `${path}[${afterIndex}]`,
        afterIndex,
        value: cloneJsonValue(after[afterIndex]),
      });
      afterIndex += 1;
    }
  }
  return changes;
}

/**
 * @param {JsonValue} before
 * @param {JsonValue} after
 * @param {string} path
 * @param {Array<Record<string, unknown>>} changes
 */
function appendJsonChanges(before, after, path, changes) {
  if (areJsonValuesEqual(before, after)) {
    return;
  }
  if (typeof before === "string" && typeof after === "string") {
    changes.push(...createTextChanges(before, after, path));
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    changes.push(...createArrayChanges(before, after, path));
    return;
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const childPath = path === "$" ? `$.${key}` : `${path}.${key}`;
      const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (!hasAfter) {
        changes.push({
          type: "remove",
          path: childPath,
          value: cloneJsonValue(/** @type {JsonValue} */ (before[key])),
        });
      } else if (!hasBefore) {
        changes.push({
          type: "add",
          path: childPath,
          value: cloneJsonValue(/** @type {JsonValue} */ (after[key])),
        });
      } else {
        appendJsonChanges(
          /** @type {JsonValue} */ (before[key]),
          /** @type {JsonValue} */ (after[key]),
          childPath,
          changes,
        );
      }
    }
    return;
  }

  changes.push({
    type: "replace",
    path,
    before: cloneJsonValue(before),
    after: cloneJsonValue(after),
  });
}

/**
 * 创建稳定、轻量且可直接用于 UI 的文本或 JSON 值差异。
 *
 * @param {JsonValue} before
 * @param {JsonValue} after
 * @returns {{kind: "unchanged" | "text" | "array" | "json" | "replace", changed: boolean, replacement: boolean, changes: Array<Record<string, unknown>>}}
 */
export function createRevisionDiff(before, after) {
  assertJsonValue(before, "before");
  assertJsonValue(after, "after");
  if (areJsonValuesEqual(before, after)) {
    return {
      kind: "unchanged",
      changed: false,
      replacement: false,
      changes: [],
    };
  }

  if (typeof before === "string" && typeof after === "string") {
    const changes = createTextChanges(before, after, "$");
    return {
      kind: "text",
      changed: true,
      replacement: !changes.some((change) => change.type === "equal"),
      changes,
    };
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes = createArrayChanges(before, after, "$");
    return {
      kind: "array",
      changed: true,
      replacement:
        before.length > 0 &&
        after.length > 0 &&
        !changes.some((change) => change.type === "equal"),
      changes,
    };
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const changes = [];
    appendJsonChanges(before, after, "$", changes);
    const sharedRootKeys = Object.keys(before).filter((key) =>
      Object.prototype.hasOwnProperty.call(after, key));
    return {
      kind: "json",
      changed: true,
      replacement:
        Object.keys(before).length > 0 &&
        Object.keys(after).length > 0 &&
        sharedRootKeys.length === 0,
      changes,
    };
  }

  return {
    kind: "replace",
    changed: true,
    replacement: true,
    changes: [
      {
        type: "replace",
        path: "$",
        before: cloneJsonValue(before),
        after: cloneJsonValue(after),
      },
    ],
  };
}

/**
 * @param {string[]} timestamps
 * @returns {string}
 */
function createNextTimestamp(...timestamps) {
  let timestamp = Date.now();
  for (const candidate of timestamps) {
    const candidateTime = Date.parse(candidate);
    if (Number.isFinite(candidateTime) && candidateTime >= timestamp) {
      timestamp = candidateTime + 1;
    }
  }
  return new Date(timestamp).toISOString();
}

/**
 * @param {unknown} entry
 * @param {string} [path]
 * @returns {RevisionHistoryEntry}
 */
function assertHistoryEntry(entry, path = "historyEntry") {
  const entryObject = assertExactObject(entry, HISTORY_ENTRY_KEYS, path);
  assertString(entryObject.fieldPath, `${path}.fieldPath`, { nonEmpty: true });
  assertJsonValue(entryObject.before, `${path}.before`);
  assertJsonValue(entryObject.after, `${path}.after`);
  assertString(entryObject.appliedAt, `${path}.appliedAt`, { nonEmpty: true });
  if (
    areJsonValuesEqual(
      /** @type {JsonValue} */ (entryObject.before),
      /** @type {JsonValue} */ (entryObject.after),
    )
  ) {
    throw new Error(`${path}.after: expected a changed value`);
  }
  return /** @type {RevisionHistoryEntry} */ (entry);
}

/**
 * 追加历史并只保留最近 20 次修改，不改变输入数组。
 *
 * @param {RevisionHistoryEntry[]} history
 * @param {RevisionHistoryEntry} historyEntry
 * @returns {RevisionHistoryEntry[]}
 */
export function appendRevisionHistory(history, historyEntry) {
  if (!Array.isArray(history)) {
    throw new Error("history: expected an array");
  }
  const entries = history.map((entry, index) =>
    cloneJsonValue(assertHistoryEntry(entry, `history[${index}]`)));
  entries.push(cloneJsonValue(assertHistoryEntry(historyEntry)));
  return /** @type {RevisionHistoryEntry[]} */ (
    entries.slice(-MAX_REVISION_HISTORY)
  );
}

/**
 * 应用用户已确认的单字段提案，返回新项目和可入栈的历史条目。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {FieldRevision} revision
 * @returns {{project: import("../contracts.js").ProjectDocument, historyEntry: RevisionHistoryEntry}}
 */
export function applyConfirmedRevision(project, revision) {
  const validRevision = assertRevisionForProject(project, revision);
  const character = project.character;
  if (character === null) {
    throw new Error("project.character: expected a generated character");
  }

  const revisedCharacter = applyFieldPatch(character, {
    fieldPath: validRevision.fieldPath,
    value: cloneJsonValue(validRevision.after),
  });
  const appliedAt = createNextTimestamp(character.meta.updatedAt, project.updatedAt);
  revisedCharacter.meta.updatedAt = appliedAt;
  assertCharacterDraft(revisedCharacter);

  const nextProject = invalidateProject(project, "character");
  nextProject.character = revisedCharacter;
  nextProject.updatedAt = appliedAt;
  assertProjectDocument(nextProject);

  return {
    project: nextProject,
    historyEntry: {
      fieldPath: validRevision.fieldPath,
      before: cloneJsonValue(validRevision.before),
      after: cloneJsonValue(validRevision.after),
      appliedAt,
    },
  };
}

/**
 * 撤销最近一次字段修改；只恢复字段值，不恢复已经失效的旧评估或平台产物。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {RevisionHistoryEntry[]} history
 * @returns {{project: import("../contracts.js").ProjectDocument, history: RevisionHistoryEntry[]}}
 */
export function undoRevision(project, history) {
  assertProjectDocument(project);
  if (project.character === null) {
    throw new Error("project.character: expected a generated character");
  }
  if (!Array.isArray(history)) {
    throw new Error("history: expected an array");
  }

  const retainedHistory = history
    .slice(-MAX_REVISION_HISTORY)
    .map((entry, index) =>
      /** @type {RevisionHistoryEntry} */ (
        cloneJsonValue(assertHistoryEntry(entry, `history[${index}]`))
      ));
  if (retainedHistory.length === 0) {
    throw new Error("history: expected at least one revision to undo");
  }

  const latestEntry = retainedHistory[retainedHistory.length - 1];
  const currentValue = getEditableValue(project.character, latestEntry.fieldPath);
  if (!areJsonValuesEqual(currentValue, latestEntry.after)) {
    throw new Error(
      `history field ${latestEntry.fieldPath}: current value no longer matches the applied revision`,
    );
  }

  const restoredCharacter = applyFieldPatch(project.character, {
    fieldPath: latestEntry.fieldPath,
    value: cloneJsonValue(latestEntry.before),
  });
  const undoneAt = createNextTimestamp(
    project.character.meta.updatedAt,
    project.updatedAt,
    latestEntry.appliedAt,
  );
  restoredCharacter.meta.updatedAt = undoneAt;
  assertCharacterDraft(restoredCharacter);

  const nextProject = invalidateProject(project, "character");
  nextProject.character = restoredCharacter;
  nextProject.updatedAt = undoneAt;
  assertProjectDocument(nextProject);

  return {
    project: nextProject,
    history: retainedHistory.slice(0, -1),
  };
}
