/**
 * 对可序列化数据做深拷贝；旧浏览器使用最小 JSON 回退。
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  try {
    if (typeof globalThis.structuredClone === "function") {
      return globalThis.structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new Error("数据无法序列化");
  }
}
