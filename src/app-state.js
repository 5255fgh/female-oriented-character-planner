import { createId } from "./contracts.js";

/**
 * 创建尚未填充业务内容的应用状态。
 *
 * @returns {object}
 */
export function createInitialAppState() {
  const timestamp = new Date().toISOString();

  return {
    id: createId("project"),
    title: "",
    brief: null,
    concepts: [],
    selectedConceptId: null,
    character: null,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    mode: "mock",
    currentStep: "brief",
    loading: false,
    error: null,
  };
}
