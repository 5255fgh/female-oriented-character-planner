import { assertProjectDocument, createId } from "../contracts.js";
import { deepClone } from "./clone.js";
import { openDatabase, requestToPromise, transactionDone } from "./indexeddb.js";

const PROJECTS_STORE = "projects";
const VERSIONS_STORE = "versions";
const VERSION_LIMIT = 20;

function asSimpleError(error, fallbackMessage) {
  if (error instanceof Error && error.name === "Error") {
    return error;
  }
  return new Error(fallbackMessage);
}

function assertStringId(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label}必须是字符串`);
  }
  return value;
}

function prepareProject(project) {
  assertProjectDocument(project);

  const timestamp = new Date().toISOString();
  const prepared = deepClone(project);
  prepared.updatedAt = timestamp;

  assertProjectDocument(prepared);
  const cloned = deepClone(prepared);
  assertProjectDocument(cloned);
  return { project: cloned };
}

function prepareVersionSnapshot(projectId, snapshot) {
  assertProjectDocument(snapshot);
  if (snapshot.id !== projectId) {
    throw new Error("版本快照与项目不匹配");
  }

  const cloned = deepClone(snapshot);
  assertProjectDocument(cloned);
  return cloned;
}

function compareByTimestampDescending(left, right, fieldName) {
  if (left[fieldName] > right[fieldName]) {
    return -1;
  }
  if (left[fieldName] < right[fieldName]) {
    return 1;
  }
  return right.id.localeCompare(left.id);
}

function compareVersionsForPruning(left, right, preferredId) {
  if (left.createdAt > right.createdAt) {
    return -1;
  }
  if (left.createdAt < right.createdAt) {
    return 1;
  }
  if (left.id === preferredId) {
    return -1;
  }
  if (right.id === preferredId) {
    return 1;
  }
  return right.id.localeCompare(left.id);
}

function assertStoredVersion(record) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("版本记录无效");
  }

  const keys = Object.keys(record);
  const expectedKeys = ["id", "projectId", "snapshot", "createdAt"];
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(record, key))
  ) {
    throw new Error("版本记录无效");
  }
  if (
    typeof record.id !== "string" ||
    typeof record.projectId !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    throw new Error("版本记录无效");
  }

  assertProjectDocument(record.snapshot);
  if (record.snapshot.id !== record.projectId) {
    throw new Error("版本快照与项目不匹配");
  }
  return record;
}

function queueVersionSave(transaction, projectId, snapshot, createdAt) {
  const versionStore = transaction.objectStore(VERSIONS_STORE);
  const record = {
    id: createId("version"),
    projectId,
    snapshot: deepClone(snapshot),
    createdAt,
  };

  versionStore.add(record);
  const versionsRequest = versionStore.index("projectId").getAll(projectId);
  versionsRequest.addEventListener(
    "success",
    () => {
      const versions = versionsRequest.result;
      if (!Array.isArray(versions)) {
        transaction.abort();
        return;
      }

      try {
        for (const version of versions) {
          assertStoredVersion(version);
        }
      } catch {
        transaction.abort();
        return;
      }

      versions.sort((left, right) =>
        compareVersionsForPruning(left, right, record.id),
      );
      for (const obsolete of versions.slice(VERSION_LIMIT)) {
        versionStore.delete(obsolete.id);
      }
    },
    { once: true },
  );

  return record;
}

function queueProjectVersionDeletion(transaction, projectId) {
  const versionStore = transaction.objectStore(VERSIONS_STORE);
  const keysRequest = versionStore.index("projectId").getAllKeys(projectId);
  keysRequest.addEventListener(
    "success",
    () => {
      if (!Array.isArray(keysRequest.result)) {
        transaction.abort();
        return;
      }
      for (const versionId of keysRequest.result) {
        versionStore.delete(versionId);
      }
    },
    { once: true },
  );
}

export async function saveProject(project) {
  const prepared = prepareProject(project);
  const database = await openDatabase();

  try {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECTS_STORE).put(prepared.project);
    await done;
    return deepClone(prepared.project);
  } catch (error) {
    throw asSimpleError(error, "保存项目失败");
  } finally {
    database.close();
  }
}

export async function getProject(id) {
  const projectId = assertStringId(id, "项目 id");
  const database = await openDatabase();

  try {
    const transaction = database.transaction(PROJECTS_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(PROJECTS_STORE).get(projectId);
    const [project] = await Promise.all([requestToPromise(request), done]);
    if (project === undefined) {
      return null;
    }

    assertProjectDocument(project);
    return deepClone(project);
  } catch (error) {
    throw asSimpleError(error, "读取项目失败");
  } finally {
    database.close();
  }
}

export async function listProjects() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(PROJECTS_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(PROJECTS_STORE).getAll();
    const [projects] = await Promise.all([requestToPromise(request), done]);
    if (!Array.isArray(projects)) {
      throw new Error("项目列表数据无效");
    }
    for (const project of projects) {
      assertProjectDocument(project);
    }
    projects.sort((left, right) =>
      compareByTimestampDescending(left, right, "updatedAt"),
    );
    return deepClone(projects);
  } catch (error) {
    throw asSimpleError(error, "读取项目列表失败");
  } finally {
    database.close();
  }
}

export async function deleteProject(id) {
  const projectId = assertStringId(id, "项目 id");
  const database = await openDatabase();

  try {
    const transaction = database.transaction(
      [PROJECTS_STORE, VERSIONS_STORE],
      "readwrite",
    );
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECTS_STORE).delete(projectId);
    queueProjectVersionDeletion(transaction, projectId);
    await done;
  } catch (error) {
    throw asSimpleError(error, "删除项目失败");
  } finally {
    database.close();
  }
}

export async function saveVersion(projectId, snapshot) {
  const id = assertStringId(projectId, "项目 id");
  const preparedSnapshot = prepareVersionSnapshot(id, snapshot);
  const createdAt = new Date().toISOString();
  const database = await openDatabase();

  try {
    const transaction = database.transaction(VERSIONS_STORE, "readwrite");
    const done = transactionDone(transaction);
    const record = queueVersionSave(transaction, id, preparedSnapshot, createdAt);
    await done;
    assertStoredVersion(record);
    return deepClone(record);
  } catch (error) {
    throw asSimpleError(error, "保存版本失败");
  } finally {
    database.close();
  }
}

export async function listVersions(projectId) {
  const id = assertStringId(projectId, "项目 id");
  const database = await openDatabase();

  try {
    const transaction = database.transaction(VERSIONS_STORE, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(VERSIONS_STORE).index("projectId").getAll(id);
    const [versions] = await Promise.all([requestToPromise(request), done]);
    if (!Array.isArray(versions)) {
      throw new Error("版本列表数据无效");
    }
    for (const version of versions) {
      assertStoredVersion(version);
    }
    versions.sort((left, right) =>
      compareByTimestampDescending(left, right, "createdAt"),
    );
    return deepClone(versions);
  } catch (error) {
    throw asSimpleError(error, "读取版本列表失败");
  } finally {
    database.close();
  }
}

export async function restoreVersion(projectId, versionId) {
  const id = assertStringId(projectId, "项目 id");
  const targetVersionId = assertStringId(versionId, "版本 id");
  const database = await openDatabase();

  try {
    const transaction = database.transaction(
      [PROJECTS_STORE, VERSIONS_STORE],
      "readwrite",
    );
    const done = transactionDone(transaction);
    const request = transaction.objectStore(VERSIONS_STORE).get(targetVersionId);
    let restoredProject = null;
    let restoreError = null;

    request.addEventListener(
      "success",
      () => {
        try {
          const version = request.result;
          if (!version || version.projectId !== id) {
            throw new Error("版本不存在或不属于该项目");
          }
          assertStoredVersion(version);

          const timestamp = new Date().toISOString();
          restoredProject = {
            ...deepClone(version.snapshot),
            id,
            updatedAt: timestamp,
          };
          assertProjectDocument(restoredProject);
          restoredProject = deepClone(restoredProject);

          transaction.objectStore(PROJECTS_STORE).put(restoredProject);
          queueVersionSave(transaction, id, restoredProject, timestamp);
        } catch (error) {
          restoreError = asSimpleError(error, "恢复版本失败");
          transaction.abort();
        }
      },
      { once: true },
    );

    try {
      await done;
    } catch (error) {
      throw restoreError ?? error;
    }

    if (!restoredProject) {
      throw restoreError ?? new Error("恢复版本失败");
    }
    return deepClone(restoredProject);
  } catch (error) {
    throw asSimpleError(error, "恢复版本失败");
  } finally {
    database.close();
  }
}
