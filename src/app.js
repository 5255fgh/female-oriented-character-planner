import "./styles.css";

import { assertCreativeBrief } from "./contracts.js";
import { appState } from "./app-state.js";
import { createTaskRunner } from "./workflow/task-runner.js";
import { createDownloadFilename, downloadText } from "./ui/download.js";
import {
  copyText,
  linesToArray,
  scrollToFieldPath,
  toReadableError,
} from "./ui/dom.js";
import { assertBriefRequirements, readCreativeBrief } from "./ui/forms.js";
import { renderApp } from "./ui/renderers.js";
import { canVisitStep } from "./ui/rendering.js";
import {
  runRulesForProject,
  runSimulationForProject,
} from "./ui/actions/evaluation-actions.js";
import {
  addCharacterRepeater,
  editPlatformPack,
  expandCharacterForProject,
  generateConceptsForProject,
  generatePackForProject,
  getLLMClientForState,
  getPackBlock,
  regenerateCharacterField,
  removeCharacterRepeater,
  updateBriefFromForm,
  updateCharacterField,
} from "./ui/actions/generation-actions.js";
import {
  createProject,
  deleteProjectFromState,
  exportSavedProject,
  importProjectIntoState,
  loadProjectIntoState,
  refreshSavedProjects,
  restoreProjectVersion,
  saveCurrentProject,
  setProjectMode,
  setProjectTitle,
} from "./ui/actions/project-actions.js";

const app = document.querySelector("#app");
const model = import.meta.env.VITE_LLM_MODEL || "deepseek-v4-flash";
const taskRunner = createTaskRunner();

function render() {
  app.innerHTML = renderApp(appState, { model });
}

function getLLMClient() {
  return getLLMClientForState(appState, model);
}

function syncStepNavigation() {
  app.querySelectorAll('[data-action="go-step"][data-step]').forEach((button) => {
    button.disabled = appState.loading || !canVisitStep(appState, Number(button.dataset.step));
  });
}

function syncUnsavedProjectUi() {
  const status = app.querySelector("[data-save-status]");
  if (status) {
    status.textContent = "有未保存修改";
    status.className = "status-pill status-warning";
  }
  app.querySelectorAll('[data-action="export-json"], [data-action="export-markdown"]')
    .forEach((button) => {
      button.disabled = true;
    });
  const helper = app.querySelector("[data-export-helper]");
  if (helper) helper.textContent = "请先保存当前修改，再导出最新版本。";
}

function showError(error) {
  appState.error = toReadableError(error);
  appState.notice = "";
  render();
}

async function runTask(action, task) {
  if (appState.loading) return;
  appState.loading = true;
  appState.pendingAction = action;
  appState.error = "";
  appState.notice = "";
  render();

  try {
    await taskRunner.run(action, () => task());
  } catch (error) {
    appState.error = toReadableError(error);
  } finally {
    appState.loading = false;
    appState.pendingAction = "";
    render();
  }
}

function goToField(fieldPath) {
  appState.activeFieldPath = fieldPath;
  appState.currentStep = 3;
  appState.error = "";
  appState.notice = "";
  render();
  requestAnimationFrame(() => scrollToFieldPath(fieldPath));
}

function updatePackIndicators(pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const lengthElement = Array.from(document.querySelectorAll("[data-pack-length]"))
    .find((element) => element.dataset.packLength === key);
  const validElement = Array.from(document.querySelectorAll("[data-pack-valid]"))
    .find((element) => element.dataset.packValid === key);
  const overElement = Array.from(document.querySelectorAll("[data-pack-over]"))
    .find((element) => element.dataset.packOver === key);
  const overBy = block.maxLength === null ? 0 : Math.max(0, block.currentLength - block.maxLength);

  if (lengthElement) lengthElement.textContent = `当前 ${block.currentLength} 字`;
  if (validElement) {
    validElement.textContent = block.valid ? "有效" : "需调整";
    validElement.className = `status-pill ${block.valid ? "status-pass" : "status-fail"}`;
  }
  if (overElement) {
    overElement.textContent = overBy > 0 ? `超出 ${overBy} 字` : "";
    overElement.classList.toggle("is-visible", overBy > 0);
  }
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  if (form.dataset.form === "new-project") {
    const title = String(new FormData(form).get("title") || "").trim();
    if (!title) {
      showError(new Error("请填写项目标题。"));
      return;
    }
    createProject(appState, title);
    render();
    return;
  }

  if (form.dataset.form === "creative-brief") {
    let brief;
    try {
      brief = readCreativeBrief(form);
      assertBriefRequirements(brief);
      assertCreativeBrief(brief);
    } catch (error) {
      showError(error);
      return;
    }
    const projectTitle = String(form.elements.projectTitle?.value || "").trim();
    if (!projectTitle) {
      showError(new Error("请填写项目标题。"));
      return;
    }
    void runTask("generate-concepts", () =>
      generateConceptsForProject(appState, brief, projectTitle, getLLMClient())
    );
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

  if (target.form?.dataset.form === "creative-brief") {
    updateBriefFromForm(appState, target.form);
    syncStepNavigation();
    return;
  }
  if (target.dataset.characterPath) {
    try {
      const value = target.dataset.valueType === "lines" ? linesToArray(target.value) : target.value;
      updateCharacterField(appState, target.dataset.characterPath, value);
      syncStepNavigation();
    } catch (error) {
      showError(error);
    }
    return;
  }
  if (target.dataset.regenerationInstruction) {
    appState.fieldInstructions[target.dataset.regenerationInstruction] = target.value;
    return;
  }
  if (target.dataset.packFlow && target.dataset.packBlock) {
    try {
      const result = editPlatformPack(
        appState,
        target.dataset.packFlow,
        target.dataset.packBlock,
        target.value,
      );
      if (result?.block) updatePackIndicators(result.pack, result.block);
    } catch (error) {
      showError(error);
    }
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "projectTitle")) {
    setProjectTitle(appState, target.value);
    syncUnsavedProjectUi();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

  if (Object.prototype.hasOwnProperty.call(target.dataset, "appMode")) {
    setProjectMode(appState, target.value);
    render();
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "importFile")) {
    const file = target.files?.[0];
    if (!file) return;
    void runTask("import-project", async () => {
      try {
        await importProjectIntoState(appState, await file.text());
      } finally {
        target.value = "";
      }
    });
  }
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled || appState.loading) return;
  const { action } = button.dataset;

  if (action === "go-step") {
    const step = Number(button.dataset.step);
    if (!canVisitStep(appState, step)) {
      showError(new Error("请先完成当前步骤所需内容。"));
      return;
    }
    appState.currentStep = step;
    appState.error = "";
    appState.notice = "";
    render();
    return;
  }
  if (action === "go-field") {
    goToField(button.dataset.fieldPath);
    return;
  }
  if (action === "expand-character") {
    const concept = appState.project.concepts.find((item) => item.id === button.dataset.conceptId);
    if (!concept) {
      showError(new Error("找不到所选候选。"));
      return;
    }
    void runTask(`expand-${concept.id}`, () =>
      expandCharacterForProject(appState, concept, getLLMClient())
    );
    return;
  }
  if (action === "regenerate-field") {
    const fieldPath = button.dataset.fieldPath;
    const instruction = (appState.fieldInstructions[fieldPath] || "").trim();
    if (!instruction) {
      showError(new Error("请先填写此字段的修改要求。"));
      return;
    }
    void runTask(`regenerate-${fieldPath}`, () =>
      regenerateCharacterField(appState, fieldPath, instruction, getLLMClient())
    );
    return;
  }
  if (action === "add-repeater") {
    addCharacterRepeater(appState, button.dataset.repeater);
    render();
    return;
  }
  if (action === "remove-repeater") {
    removeCharacterRepeater(appState, button.dataset.repeater, Number(button.dataset.index));
    render();
    return;
  }
  if (action === "run-rules") {
    void runTask("run-rules", () => runRulesForProject(appState));
    return;
  }
  if (action === "run-simulation") {
    void runTask("run-simulation", () => runSimulationForProject(appState, getLLMClient()));
    return;
  }
  if (action === "generate-pack") {
    void runTask("generate-pack", () => generatePackForProject(appState, getLLMClient()));
    return;
  }
  if (action === "copy-pack-block") {
    const block = getPackBlock(appState, button.dataset.packFlow, button.dataset.packBlock);
    if (!block) {
      showError(new Error("找不到要复制的输入包字段。"));
      return;
    }
    void runTask(`copy-${block.id}`, async () => {
      await copyText(block.text);
      appState.notice = `“${block.label}”已复制。`;
    });
    return;
  }
  if (action === "save-project") {
    void runTask("save-project", () => saveCurrentProject(appState));
    return;
  }
  if (action === "load-project") {
    void runTask("load-project", () => loadProjectIntoState(appState, button.dataset.projectId));
    return;
  }
  if (action === "delete-project") {
    const project = appState.savedProjects.find((item) => item.id === button.dataset.projectId);
    if (!window.confirm(`确定删除“${project?.title || "未命名项目"}”及其历史版本吗？`)) return;
    void runTask("delete-project", () => deleteProjectFromState(appState, button.dataset.projectId));
    return;
  }
  if (action === "restore-version") {
    void runTask("restore-version", () => restoreProjectVersion(appState, button.dataset.versionId));
    return;
  }
  if (action === "export-json" || action === "export-markdown") {
    const isJson = action === "export-json";
    void runTask(action, async () => {
      const content = await exportSavedProject(appState, isJson ? "json" : "markdown");
      const extension = isJson ? "json" : "md";
      downloadText(
        content,
        createDownloadFilename(appState.project.title, extension),
        isJson ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8",
      );
      appState.notice = `${isJson ? "JSON" : "Markdown"} 已导出。`;
    });
    return;
  }
  if (action === "choose-import") app.querySelector("[data-import-file]")?.click();
});

render();
void runTask("load-projects", () => refreshSavedProjects(appState));
