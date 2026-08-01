import {
  MAOXIANG_FIELD_LABELS,
  MAOXIANG_FLOW_STATUS,
  MAOXIANG_RULES,
} from "./rules.js";

/**
 * 递归冻结兼容配置，避免旧 UI 接口改写规则。
 *
 * @template {object} T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * 兼容现有调用方的配置视图；所有验证字段均派生自 rules.js。
 */
export const MAOXIANG_FLOWS = deepFreeze(
  Object.fromEntries(
    Object.entries(MAOXIANG_RULES).map(([flowId, fieldRules]) => [
      flowId,
      {
        enabled: MAOXIANG_FLOW_STATUS[flowId].enabled,
        ...Object.fromEntries(
          Object.entries(fieldRules).map(([fieldId, rule]) => [
            fieldId,
            {
              label: MAOXIANG_FIELD_LABELS[flowId][fieldId],
              ...rule,
            },
          ]),
        ),
      },
    ]),
  ),
);
