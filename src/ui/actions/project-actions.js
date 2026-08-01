import { assertCharacterProject } from "../../contracts.js";
import {
  deleteProject,
  exportProjectJson,
  exportProjectMarkdown,
  getProject,
  importProjectJson,
  listProjects,
  listVersions,
  restoreVersion,
  saveProject,
} from "../../storage/index.js";
import {
  createWorkingProject,
} from "../../app-state.js";

function replaceProject(state, project) {
  state.project = structuredClone(project);
  state.selectedConceptId = project.selectedConceptId;
  state.error = "";
  state.notice = "";
  state.activeFieldPath = "";
  state.fieldInstructions = {};
  state.dirty = false;
}

export async function refreshSavedProjects(state) {
  state.savedProjects = await listProjects();
}

export async function refreshVersions(state) {
  const isStored = state.savedProjects.some((project) => project.id === state.project.id);
  state.versions = isStored ? await listVersions(state.project.id) : [];
}

export function createProject(state, title) {
  state.project = createWorkingProject(title);
  state.selectedConceptId = "";
  state.currentStep = 1;
  state.error = "";
  state.notice = "";
  state.activeFieldPath = "";
  state.versions = [];
  state.fieldInstructions = {};
  state.dirty = true;
}

export function setProjectMode(state, mode) {
  state.mode = mode === "real" ? "real" : "mock";
  state.error = "";
  state.notice = "运行模式已切换，当前项目内容保持不变。";
}

export function setProjectTitle(state, title) {
  state.project.title = title;
  state.dirty = true;
  state.notice = "";
}

export async function importProjectIntoState(state, fileContent) {
  const imported = await importProjectJson(fileContent);
  replaceProject(state, imported);
  state.currentStep = 6;
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "JSON 项目已导入并另存为新项目。";
}

export function assertProjectReadyToSave(state) {
  state.project.title = state.project.title.trim();
  if (!state.project.title) throw new Error("请填写项目标题后再保存。");
  if (state.project.platformPacks.length === 0) throw new Error("请先生成猫箱输入包后再保存。");
  state.project.selectedConceptId = state.selectedConceptId;
  assertCharacterProject(state.project);
}

export async function saveCurrentProject(state) {
  assertProjectReadyToSave(state);
  const saved = await saveProject(state.project);
  replaceProject(state, saved);
  state.currentStep = 6;
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "项目已保存，并创建了一个历史版本。";
}

export async function loadProjectIntoState(state, projectId) {
  const project = await getProject(projectId);
  if (!project) throw new Error("项目不存在或已被删除。");
  replaceProject(state, project);
  state.currentStep = 3;
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "已打开本地项目。";
}

export async function deleteProjectFromState(state, projectId) {
  await deleteProject(projectId);
  if (state.project.id === projectId) {
    createProject(state, "");
    state.currentStep = 0;
  }
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "项目及其历史版本已删除。";
}

export async function restoreProjectVersion(state, versionId) {
  const restored = await restoreVersion(state.project.id, versionId);
  replaceProject(state, restored);
  state.currentStep = 6;
  await refreshSavedProjects(state);
  await refreshVersions(state);
  state.notice = "历史版本已恢复，并保留了恢复后的新版本。";
}

export async function exportSavedProject(state, format) {
  const isStored = state.savedProjects.some((project) => project.id === state.project.id);
  if (state.dirty || !isStored) throw new Error("请先保存当前修改，再导出最新版本。");
  return format === "json"
    ? exportProjectJson(state.project.id)
    : exportProjectMarkdown(state.project.id);
}
