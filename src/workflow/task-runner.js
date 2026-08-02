function createAbortError(taskId) {
  const error = new Error(`Task "${taskId}" was cancelled`);
  error.name = "AbortError";
  return error;
}

/**
 * 创建小型任务运行器：同名任务只能运行一个，并可通过 AbortSignal 取消。
 */
export function createTaskRunner() {
  const activeTasks = new Map();

  return {
    /**
     * @template T
     * @param {string} taskId
     * @param {(context: {signal: AbortSignal}) => Promise<T> | T} task
     * @returns {Promise<T>}
     */
    run(taskId, task) {
      if (typeof taskId !== "string" || taskId.trim().length === 0) {
        return Promise.reject(new Error("taskId: expected a non-empty string"));
      }
      if (typeof task !== "function") {
        return Promise.reject(new Error("task: expected a function"));
      }
      if (activeTasks.has(taskId)) {
        return Promise.reject(new Error(`Task "${taskId}" is already running`));
      }

      const controller = new AbortController();
      activeTasks.set(taskId, controller);
      const taskPromise = Promise.resolve().then(() => task({ signal: controller.signal }));

      return new Promise((resolve, reject) => {
        const abort = () => reject(createAbortError(taskId));
        const cleanup = () => {
          controller.signal.removeEventListener("abort", abort);
          if (activeTasks.get(taskId) === controller) activeTasks.delete(taskId);
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        taskPromise.then(
          (value) => {
            cleanup();
            if (!controller.signal.aborted) resolve(value);
          },
          (error) => {
            cleanup();
            if (!controller.signal.aborted) reject(error);
          },
        );
      });
    },

    /** @param {string} taskId @returns {boolean} */
    cancel(taskId) {
      const controller = activeTasks.get(taskId);
      if (!controller) return false;
      controller.abort();
      activeTasks.delete(taskId);
      return true;
    },

    cancelAll() {
      for (const controller of activeTasks.values()) controller.abort();
      activeTasks.clear();
    },

    /** @param {string} taskId @returns {boolean} */
    isRunning(taskId) {
      return activeTasks.has(taskId);
    },
  };
}
