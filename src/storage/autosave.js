import { assertProjectDocument } from "../contracts.js";
import { deepClone } from "./clone.js";
import { saveProject } from "./repository.js";

export const DEFAULT_AUTOSAVE_DELAY = 1000;
const MIN_AUTOSAVE_DELAY = 800;
const MAX_AUTOSAVE_DELAY = 1500;

function asError(error) {
  return error instanceof Error ? error : new Error("自动保存失败");
}

function resolveEventTarget(eventTarget) {
  if (eventTarget !== undefined) {
    return eventTarget;
  }
  if (typeof globalThis.window?.addEventListener === "function") {
    return globalThis.window;
  }
  return null;
}

/**
 * 创建轻量自动保存服务。每个项目独立防抖，同一项目的写入按提交顺序串行执行。
 *
 * @param {{
 *   delay?: number,
 *   save?: (project: import("../contracts/project.js").ProjectDocument) => Promise<unknown>,
 *   onStatus?: (event: {status: "pending" | "saving" | "saved" | "error" | "cancelled", projectId: string, error?: Error}) => void,
 *   eventTarget?: {addEventListener: Function} | null
 * }} [options]
 */
export function createAutosaveService(options = {}) {
  const delay = options.delay ?? DEFAULT_AUTOSAVE_DELAY;
  if (
    !Number.isFinite(delay) ||
    delay < MIN_AUTOSAVE_DELAY ||
    delay > MAX_AUTOSAVE_DELAY
  ) {
    throw new Error("自动保存防抖时间必须在 800—1500ms 之间");
  }

  const save = options.save ?? saveProject;
  if (typeof save !== "function") {
    throw new Error("自动保存函数无效");
  }
  const onStatus = options.onStatus ?? (() => {});
  if (typeof onStatus !== "function") {
    throw new Error("自动保存状态回调无效");
  }

  /** @type {Map<string, {pending: import("../contracts/project.js").ProjectDocument | null, timer: ReturnType<typeof setTimeout> | null, writeTail: Promise<void>}>} */
  const states = new Map();

  function notify(status, projectId, error) {
    try {
      onStatus(error ? { status, projectId, error } : { status, projectId });
    } catch {
      // 状态展示异常不能破坏持久化。
    }
  }

  function getState(projectId) {
    let state = states.get(projectId);
    if (!state) {
      state = {
        pending: null,
        timer: null,
        writeTail: Promise.resolve(),
      };
      states.set(projectId, state);
    }
    return state;
  }

  function enqueuePending(projectId, state) {
    if (!state.pending) {
      return state.writeTail;
    }

    const snapshot = state.pending;
    state.pending = null;
    const write = state.writeTail
      .catch(() => {})
      .then(async () => {
        notify("saving", projectId);
        try {
          await save(deepClone(snapshot));
          notify("saved", projectId);
        } catch (error) {
          const saveError = asError(error);
          notify("error", projectId, saveError);
          throw saveError;
        }
      });

    state.writeTail = write;
    // 定时触发的保存没有直接调用方等待，先挂拒绝处理以免出现未处理 Promise。
    void write.catch(() => {});
    return write;
  }

  function schedule(project) {
    assertProjectDocument(project);
    const snapshot = deepClone(project);
    assertProjectDocument(snapshot);
    const projectId = snapshot.id;
    const state = getState(projectId);

    state.pending = snapshot;
    if (state.timer !== null) {
      clearTimeout(state.timer);
    }
    notify("pending", projectId);
    state.timer = setTimeout(() => {
      state.timer = null;
      enqueuePending(projectId, state);
    }, delay);
  }

  async function flush() {
    const writes = [];
    for (const [projectId, state] of states) {
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      enqueuePending(projectId, state);
      writes.push(state.writeTail);
    }
    await Promise.all(writes);
  }

  function cancel() {
    for (const [projectId, state] of states) {
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (state.pending) {
        state.pending = null;
        notify("cancelled", projectId);
      }
    }
  }

  const eventTarget = resolveEventTarget(options.eventTarget);
  if (eventTarget && typeof eventTarget.addEventListener === "function") {
    const flushBeforeUnload = () => {
      void flush().catch(() => {});
    };
    eventTarget.addEventListener("pagehide", flushBeforeUnload);
    eventTarget.addEventListener("beforeunload", flushBeforeUnload);
  }

  return { schedule, flush, cancel };
}
