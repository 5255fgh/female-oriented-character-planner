import { migrateStoredProject } from "./migrations.js";

export const DATABASE_NAME = "female-oriented-character-planner";
export const DATABASE_VERSION = 2;

const PROJECTS_STORE = "projects";
const VERSIONS_STORE = "versions";

function createError(message, source) {
  const detail = source && typeof source.message === "string" ? source.message : "";
  return new Error(detail ? `${message}：${detail}` : message);
}

/**
 * 将原生 IndexedDB 请求转换为 Promise。
 *
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(createError("本地项目库请求失败", request.error)),
      { once: true },
    );
  });
}

/**
 * 只在事务完整提交后完成；事务错误或中止都会拒绝。
 *
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const complete = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const fail = () => {
      if (settled) {
        return;
      }
      settled = true;
      reject(createError("本地项目库事务失败", transaction.error));
    };

    transaction.addEventListener("complete", complete, { once: true });
    transaction.addEventListener("error", fail, { once: true });
    transaction.addEventListener("abort", fail, { once: true });
  });
}

function ensureStoresAndIndexes(database, transaction) {
  const projects = database.objectStoreNames.contains(PROJECTS_STORE)
    ? transaction.objectStore(PROJECTS_STORE)
    : database.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
  if (!projects.indexNames.contains("updatedAt")) {
    projects.createIndex("updatedAt", "updatedAt", { unique: false });
  }

  const versions = database.objectStoreNames.contains(VERSIONS_STORE)
    ? transaction.objectStore(VERSIONS_STORE)
    : database.createObjectStore(VERSIONS_STORE, { keyPath: "id" });
  if (!versions.indexNames.contains("projectId")) {
    versions.createIndex("projectId", "projectId", { unique: false });
  }
  if (!versions.indexNames.contains("createdAt")) {
    versions.createIndex("createdAt", "createdAt", { unique: false });
  }
  if (!versions.indexNames.contains("projectIdCreatedAt")) {
    versions.createIndex(
      "projectIdCreatedAt",
      ["projectId", "createdAt"],
      { unique: false },
    );
  }

  return { projects, versions };
}

function migrateProjectRecords(store, transaction, setUpgradeError) {
  const request = store.getAll();
  request.addEventListener(
    "success",
    () => {
      try {
        if (!Array.isArray(request.result)) {
          throw new Error("项目 Object Store 返回了无效数据");
        }
        for (const record of request.result) {
          store.put(migrateStoredProject(record));
        }
      } catch (error) {
        setUpgradeError(error);
        transaction.abort();
      }
    },
    { once: true },
  );
}

function migrateVersionRecords(store, transaction, setUpgradeError) {
  const request = store.getAll();
  request.addEventListener(
    "success",
    () => {
      try {
        if (!Array.isArray(request.result)) {
          throw new Error("版本 Object Store 返回了无效数据");
        }
        for (const record of request.result) {
          if (record === null || typeof record !== "object" || Array.isArray(record)) {
            throw new Error("版本记录无效");
          }
          if (
            typeof record.id !== "string" ||
            typeof record.projectId !== "string" ||
            typeof record.createdAt !== "string" ||
            !Object.prototype.hasOwnProperty.call(record, "snapshot")
          ) {
            throw new Error("版本记录无效");
          }

          const snapshot = migrateStoredProject(record.snapshot);
          if (snapshot.id !== record.projectId) {
            throw new Error("版本快照与项目不匹配");
          }
          store.put({
            id: record.id,
            projectId: record.projectId,
            snapshot,
            createdAt: record.createdAt,
          });
        }
      } catch (error) {
        setUpgradeError(error);
        transaction.abort();
      }
    },
    { once: true },
  );
}

/**
 * 打开固定版本的本地项目库。v2 保留原有 Object Store，迁移旧项目/版本记录，
 * 并为版本增加 [projectId, createdAt] 复合索引。
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  const indexedDatabase = globalThis.indexedDB;
  if (!indexedDatabase || typeof indexedDatabase.open !== "function") {
    throw new Error("当前浏览器不支持本地项目库");
  }

  let request;
  try {
    request = indexedDatabase.open(DATABASE_NAME, DATABASE_VERSION);
  } catch (error) {
    throw createError("无法打开本地项目库", error);
  }

  let upgradeError = null;
  request.addEventListener("upgradeneeded", (event) => {
    try {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) {
        throw new Error("数据库升级事务不可用");
      }

      const stores = ensureStoresAndIndexes(database, transaction);
      if (event.oldVersion > 0 && event.oldVersion < 2) {
        const setUpgradeError = (error) => {
          upgradeError = error;
        };
        migrateProjectRecords(stores.projects, transaction, setUpgradeError);
        migrateVersionRecords(stores.versions, transaction, setUpgradeError);
      }
    } catch (error) {
      upgradeError = error;
      request.transaction?.abort();
    }
  });

  return new Promise((resolve, reject) => {
    let settled = false;

    request.addEventListener(
      "success",
      () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }

        settled = true;
        database.addEventListener(
          "versionchange",
          () => database.close(),
          { once: true },
        );
        resolve(database);
      },
      { once: true },
    );

    request.addEventListener(
      "error",
      () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(
          createError(
            upgradeError ? "升级本地项目库失败" : "打开本地项目库失败",
            upgradeError ?? request.error,
          ),
        );
      },
      { once: true },
    );

    request.addEventListener(
      "blocked",
      () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("本地项目库升级被阻塞，请关闭其他已打开页面后重试"));
      },
      { once: true },
    );
  });
}
