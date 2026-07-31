const DATABASE_NAME = "female-oriented-character-planner";
const DATABASE_VERSION = 1;

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

/**
 * 打开固定版本的本地项目库，并只创建约定的两个 Object Store。
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

  let upgradeFailed = false;
  request.addEventListener("upgradeneeded", () => {
    try {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) {
        throw new Error("数据库升级事务不可用");
      }

      const projects = database.objectStoreNames.contains("projects")
        ? transaction.objectStore("projects")
        : database.createObjectStore("projects", { keyPath: "id" });
      if (!projects.indexNames.contains("updatedAt")) {
        projects.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      const versions = database.objectStoreNames.contains("versions")
        ? transaction.objectStore("versions")
        : database.createObjectStore("versions", { keyPath: "id" });
      if (!versions.indexNames.contains("projectId")) {
        versions.createIndex("projectId", "projectId", { unique: false });
      }
      if (!versions.indexNames.contains("createdAt")) {
        versions.createIndex("createdAt", "createdAt", { unique: false });
      }
    } catch {
      upgradeFailed = true;
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
        database.addEventListener("versionchange", () => database.close());
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
            upgradeFailed ? "初始化本地项目库失败" : "打开本地项目库失败",
            request.error,
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
        reject(new Error("本地项目库正在被其他页面占用"));
      },
      { once: true },
    );
  });
}
