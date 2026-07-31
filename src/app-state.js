import { createId } from "./contracts.js";

export function createEmptyBrief() {
  return {
    platform: "maoxiang",
    outputMode: "free_character",
    characterGender: "",
    ageRange: "",
    worldSetting: "",
    characterIdentity: "",
    coreExperiences: [],
    relationshipType: "",
    coreConflict: "",
    personalityContradiction: "",
    initiativeLevel: "medium",
    interactionTone: [],
    boundaries: [],
    bannedBehaviors: [],
    extraNotes: "",
  };
}

export function createWorkingProject(title = "") {
  const timestamp = new Date().toISOString();

  return {
    id: createId("project"),
    title,
    brief: createEmptyBrief(),
    concepts: [],
    selectedConceptId: "",
    character: null,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * 创建单一普通对象形式的应用状态。
 *
 * @returns {object}
 */
export function createInitialAppState() {
  return {
    mode: "mock",
    currentStep: 0,
    project: createWorkingProject(),
    selectedConceptId: "",
    loading: false,
    error: "",
    activeFieldPath: "",
    savedProjects: [],
    versions: [],
    fieldInstructions: {},
    pendingAction: "",
    notice: "",
    dirty: false,
  };
}

export const appState = createInitialAppState();

export function resetCurrentProject(title = "") {
  appState.project = createWorkingProject(title);
  appState.selectedConceptId = "";
  appState.currentStep = 1;
  appState.error = "";
  appState.notice = "";
  appState.activeFieldPath = "";
  appState.versions = [];
  appState.fieldInstructions = {};
  appState.dirty = true;
}

export function replaceCurrentProject(project) {
  appState.project = structuredClone(project);
  appState.selectedConceptId = project.selectedConceptId;
  appState.error = "";
  appState.notice = "";
  appState.activeFieldPath = "";
  appState.fieldInstructions = {};
  appState.dirty = false;
}

export function markProjectChanged() {
  appState.dirty = true;
  appState.notice = "";
}
