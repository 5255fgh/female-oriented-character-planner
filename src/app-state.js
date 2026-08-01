import { createId } from "./contracts.js";

export const GENERATION_STAGE_DEFINITIONS = Object.freeze([
  { id: "analyze", label: "分析灵感" },
  { id: "generate", label: "生成角色或故事" },
  { id: "check", label: "快速检查" },
  { id: "platform", label: "生成平台文本" },
]);

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
    seed: null,
    brief: null,
    concepts: [],
    selectedConceptId: null,
    character: null,
    worldBible: null,
    storyDraft: null,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    generationRecords: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createGenerationProgress() {
  return GENERATION_STAGE_DEFINITIONS.map((stage) => ({
    ...stage,
    status: "pending",
  }));
}

function inferProjectKind(project) {
  if (
    project?.storyDraft ||
    project?.platformPacks?.some((pack) => pack.flowId === "editor_open_story") ||
    project?.generationRecords?.some((record) => record.target === "story")
  ) {
    return "story";
  }
  return "character";
}

/**
 * 创建仅由普通对象组成的 UI 状态；瞬时状态不会写入 ProjectDocument。
 */
export function createInitialAppState() {
  return {
    mode: "mock",
    currentStep: "home",
    projectKind: "character",
    generationMode: "direct",
    project: createWorkingProject(),
    quickInput: {
      idea: "",
      mustInclude: "",
      avoid: "",
    },
    advancedBrief: createEmptyBrief(),
    questions: [],
    answers: {},
    progress: createGenerationProgress(),
    progressStatus: "idle",
    selectedConceptId: null,
    quickDialogueReport: null,
    storyCheck: null,
    pendingRevision: null,
    revisionDiff: null,
    revisionHistory: [],
    fieldInstructions: {},
    activeFieldPath: "",
    savedProjects: [],
    versions: [],
    recoveryProjectId: "",
    recoveryDismissed: false,
    autosaveStatus: "idle",
    autosaveError: "",
    loading: false,
    pendingAction: "",
    error: "",
    notice: "",
    dirty: false,
  };
}

export const appState = createInitialAppState();

export function inferKindFromProject(project) {
  return inferProjectKind(project);
}
