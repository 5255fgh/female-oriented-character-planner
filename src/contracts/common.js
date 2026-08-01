/**
 * @typedef {null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue}} JsonValue
 */

/**
 * @typedef {object} FieldPatch
 * @property {string} fieldPath
 * @property {JsonValue} value
 */

const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * @param {string} path
 * @param {string} message
 * @returns {never}
 */
export function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function assertObject(value, path) {
  if (!isPlainObject(value)) {
    fail(path, "expected an object");
  }
  return value;
}

/**
 * @param {Record<string, unknown>} value
 * @param {readonly string[]} expectedKeys
 * @param {string} path
 */
export function assertExactKeys(value, expectedKeys, path) {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      fail(`${path}.${key}`, "unexpected field");
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string}
 */
export function assertString(value, path) {
  if (typeof value !== "string") {
    fail(path, "expected a string");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {boolean}
 */
export function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    fail(path, "expected a boolean");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {number}
 */
export function assertNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite number");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowedValues
 * @param {string} path
 * @returns {string}
 */
export function assertEnum(value, allowedValues, path) {
  const stringValue = assertString(value, path);
  if (!allowedValues.includes(stringValue)) {
    fail(path, `expected one of: ${allowedValues.join(", ")}`);
  }
  return stringValue;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {unknown[]}
 */
export function assertArray(value, path) {
  if (!Array.isArray(value)) {
    fail(path, "expected an array");
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      fail(`${path}[${index}]`, "missing array item");
    }
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string[]}
 */
export function assertStringArray(value, path) {
  const array = assertArray(value, path);
  for (let index = 0; index < array.length; index += 1) {
    assertString(array[index], `${path}[${index}]`);
  }
  return /** @type {string[]} */ (array);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {Set<object>} [ancestors]
 */
export function assertJsonValue(value, path, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(path, "expected a JSON-serializable finite number");
    }
    return;
  }

  if (typeof value !== "object") {
    fail(path, "expected a JSON-serializable value");
  }

  if (ancestors.has(value)) {
    fail(path, "expected a JSON-serializable value without circular references");
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        fail(`${path}[${index}]`, "sparse arrays are not supported");
      }
      assertJsonValue(value[index], `${path}[${index}]`, ancestors);
    }
  } else {
    const objectValue = assertObject(value, path);
    for (const key of Object.keys(objectValue)) {
      assertJsonValue(objectValue[key], `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

/**
 * @param {JsonValue} value
 * @returns {JsonValue}
 */
export function cloneJsonValue(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  /** @type {{[key: string]: JsonValue}} */
  const clone = {};
  for (const [key, childValue] of Object.entries(value)) {
    Object.defineProperty(clone, key, {
      value: cloneJsonValue(childValue),
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
  return clone;
}

/**
 * @param {string} fieldPath
 * @param {string} errorPath
 * @returns {string[]}
 */
function parseFieldPath(fieldPath, errorPath) {
  if (fieldPath.length === 0) {
    fail(errorPath, "field path must not be empty");
  }

  const validPathPattern = /^[A-Za-z_$][A-Za-z0-9_$-]*(?:\.[A-Za-z0-9_$-]+)*$/;
  if (!validPathPattern.test(fieldPath)) {
    fail(errorPath, `invalid field path "${fieldPath}"`);
  }

  const segments = fieldPath.split(".");
  for (const segment of segments) {
    if (BLOCKED_PATH_SEGMENTS.has(segment)) {
      fail(errorPath, `unsafe field path segment "${segment}" in "${fieldPath}"`);
    }
  }
  return segments;
}

/**
 * @param {unknown} object
 * @param {string[]} segments
 * @param {string} fieldPath
 * @returns {unknown}
 */
function resolvePath(object, segments, fieldPath) {
  let current = object;
  const traversed = [];
  for (const segment of segments) {
    traversed.push(segment);
    if (current === null || typeof current !== "object") {
      fail(fieldPath, `cannot traverse "${traversed.join(".")}" through a non-object value`);
    }
    if (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(segment)) {
      fail(fieldPath, `expected an array index at "${traversed.join(".")}"`);
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      fail(fieldPath, `path segment "${segment}" does not exist at "${traversed.join(".")}"`);
    }
    current = /** @type {Record<string, unknown>} */ (current)[segment];
  }
  return current;
}

/**
 * @param {unknown} value
 * @returns {FieldPatch}
 */
export function assertFieldPatch(value) {
  const patch = assertObject(value, "FieldPatch");
  assertExactKeys(patch, ["fieldPath", "value"], "FieldPatch");
  const fieldPath = assertString(patch.fieldPath, "FieldPatch.fieldPath");
  parseFieldPath(fieldPath, "FieldPatch.fieldPath");
  assertJsonValue(patch.value, "FieldPatch.value");
  return /** @type {FieldPatch} */ (value);
}

/**
 * 使用点分隔路径读取值；数组项使用 `stages.0.name` 形式的十进制索引段。
 *
 * @param {object} object
 * @param {string} fieldPath
 * @returns {unknown}
 */
export function getValueAtPath(object, fieldPath) {
  if (object === null || typeof object !== "object") {
    fail("object", "expected an object");
  }
  const path = assertString(fieldPath, "fieldPath");
  return resolvePath(object, parseFieldPath(path, "fieldPath"), path);
}

/**
 * 将补丁应用到现有字段并返回完全独立的副本，不保留源对象或补丁值的引用。
 *
 * @template {object} T
 * @param {T} object
 * @param {FieldPatch} patch
 * @returns {T}
 */
export function applyFieldPatch(object, patch) {
  assertFieldPatch(patch);
  assertJsonValue(object, "object");
  const segments = parseFieldPath(patch.fieldPath, "FieldPatch.fieldPath");
  resolvePath(object, segments, patch.fieldPath);

  const clonedObject = /** @type {T} */ (cloneJsonValue(/** @type {JsonValue} */ (object)));
  let target = /** @type {Record<string, unknown> | unknown[]} */ (clonedObject);
  for (let index = 0; index < segments.length - 1; index += 1) {
    target = /** @type {Record<string, unknown> | unknown[]} */ (
      /** @type {Record<string, unknown>} */ (target)[segments[index]]
    );
  }

  const finalSegment = segments[segments.length - 1];
  /** @type {Record<string, unknown>} */ (target)[finalSegment] = cloneJsonValue(patch.value);
  return clonedObject;
}

/**
 * 按 Unicode 码点而不是 UTF-16 代码单元计数。
 *
 * @param {string} text
 * @returns {number}
 */
export function countUnicodeCharacters(text) {
  return Array.from(assertString(text, "text")).length;
}

/**
 * @param {string} prefix
 * @returns {string}
 */
export function createId(prefix) {
  const safePrefix = assertString(prefix, "prefix").trim();
  if (safePrefix.length === 0) {
    fail("prefix", "expected a non-empty string");
  }

  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${safePrefix}-${randomPart}`;
}
