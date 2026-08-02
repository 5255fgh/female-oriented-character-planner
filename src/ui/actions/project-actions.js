import { assertProjectDocument } from "../../contracts.js";
import {
  createAutosaveService,
  deleteProject,
  exportProjectJson,
  exportProjectMarkdown,
  getProject,
  importProjectJson,
  listProjects,
  listVersions,
  restoreVersion,
  saveProject,
  saveVersion,
} from "../../storage/index.js";
import {
  createEmptyBrief,
  createGenerationProgress,
  createWorkingProject,
  inferKindFromProject,
} from "../../app-state.js";

function inferView(project) {
  if (project.character || project.storyDraft || project.platformPacks.length > 0) {
    return "result";
  }
  if (project.concepts.length === 3) return "concepts";
  return "create";
}

function replaceProject(state, project) {
  assertProjectDocument(project);
  state.project = structuredClone(project);
  state.projectKind = inferKindFromProject(project);
  state.currentStep = inferView(project);
  state.selectedConceptId = project.selectedConceptId;
  state.error = "";
  state.notice = "";
  state.activeFieldPath = "";
  state.fieldInstructions = {};
  state.questions = [];
  state.answers = {};
  state.quickDialogueReport = null;
  state.storyCheck = project.storyDraft
    ? { status: "pass", message: "故事结构已通过共享契约校验。" }
    : null;
  state.pendingRevision = null;
  state.revisionDiff = null;
  state.revisionHistory = [];
  state.dirty = false;
  state.autosaveStatus = "saved";
  state.autosaveError = "";
}

export function createProjectAutosaveService(options) {
  return createAutosaveService(options);
}

export async function refreshSavedProjects(state) {
  state.savedProjects = await listProjects();
  if (
    !state.recoveryDismissed &&
    !state.recoveryProjectId &&
    state.savedProjects.length > 0
  ) {
    state.recoveryProjectId = state.savedProjects[0].id;
  }
}

export async function refreshVersions(state) {
  const isStored = state.savedProjects.some(
    (project) => project.id === state.project.id,
  );
  state.versions = isStored ? await listVersions(state.project.id) : [];
}

export function createProject(state, kind) {
  const projectKind = kind === "story" ? "story" : "character";
  state.projectKind = projectKind;
  state.project = createWorkingProject(
    projectKind === "story" ? "未命名开放故事" : "未命名角色",
  );
  state.currentStep = "create";
  state.generationMode = "direct";
  state.quickInput = { idea: "", mustInclude: "", avoid: "" };
  state.advancedBrief = createEmptyBrief();
  state.questions = [];
  state.answers = {};
  state.progress = createGenerationProgress();
  state.progressStatus = "idle";
  state.selectedConceptId = null;
  state.quickDialogueReport = null;
  state.storyCheck = null;
  state.pendingRevision = null;
  state.revisionDiff = null;
  state.revisionHistory = [];
  state.fieldInstructions = {};
  state.activeFieldPath = "";
  state.versions = [];
  state.error = "";
  state.notice = "";
  state.autosaveStatus = "idle";
  state.autosaveError = "";
  state.dirty = false;
}

export function setProjectMode(state, mode) {
  state.mode = mode === "real" ? "real" : "mock";
  state.error = "";
  state.notice = state.mode === "real"
    ? "已切换为真实 API；密钥仍只由本地代理读取。"
    : "已切换为本地 Mock 演示。";
}

export function setProjectTitle(state, title) {
  state.project.title = String(title || "");
  state.project.updatedAt = new Date().toISOString();
  assertProjectDocument(state.project);
  state.dirty = true;
  state.notice = "";
}

export async function importProjectIntoState(state, fileContent) {
  const imported = await importProjectJson(fileContent);
  replaceProject(state, imported);
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "JSON 项目已校验、迁移并另存为新项目。";
}

export async function saveProjectCheckpoint(state, { createVersion = false } = {}) {
  assertProjectDocument(state.project);
  state.autosaveStatus = "saving";
  state.autosaveError = "";
  const saved = await saveProject(state.project);
  state.project = saved;
  if (createVersion) {
    await saveVersion(saved.id, saved);
  }
  state.autosaveStatus = "saved";
  state.dirty = false;
  await refreshSavedProjects(state);
  await refreshVersions(state);
  return saved;
}

export async function saveCurrentProject(state) {
  const saved = await saveProjectCheckpoint(state, { createVersion: true });
  state.notice = "项目已保存，并创建了一个历史版本。";
  return saved;
}

export async function loadProjectIntoState(state, projectId) {
  const project = await getProject(projectId);
  if (!project) throw new Error("项目不存在或已被删除。");
  replaceProject(state, project);
  state.recoveryProjectId = "";
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "已打开本地项目。";
}

export async function deleteProjectFromState(state, projectId) {
  await deleteProject(projectId);
  if (state.project.id === projectId) {
    createProject(state, "character");
    state.currentStep = "home";
  }
  if (state.recoveryProjectId === projectId) state.recoveryProjectId = "";
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "项目及其历史版本已删除。";
}

export async function restoreProjectVersion(state, versionId) {
  const restored = await restoreVersion(state.project.id, versionId);
  replaceProject(state, restored);
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "历史版本已恢复，并保留了恢复后的新版本。";
}

export async function exportSavedProject(state, format) {
  const isStored = state.savedProjects.some(
    (project) => project.id === state.project.id,
  );
  if (!isStored) {
    await saveProjectCheckpoint(state);
  }
  return format === "json"
    ? exportProjectJson(state.project.id)
    : exportProjectMarkdown(state.project.id);
}

export function dismissRecovery(state) {
  state.recoveryDismissed = true;
  state.recoveryProjectId = "";
}
