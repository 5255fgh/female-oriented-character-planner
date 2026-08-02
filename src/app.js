import "./styles.css";

import { assertProjectDocument } from "./contracts.js";
import { appState } from "./app-state.js";
import { createTaskRunner } from "./workflow/index.js";
import { createDownloadFilename, downloadText } from "./ui/download.js";
import {
  copyText,
  linesToArray,
  scrollToFieldPath,
  toReadableError,
} from "./ui/dom.js";
import {
  readCreativeBrief,
  readQuestionAnswers,
  readQuickInput,
} from "./ui/forms.js";
import { renderApp } from "./ui/renderers.js";
import {
  AUTOSAVE_LABELS,
  autosaveStatusClass,
} from "./ui/rendering.js";
import { runSimulationForProject } from "./ui/actions/evaluation-actions.js";
import {
  appendGenerationRecord,
  addCharacterRepeater,
  analyzeSeedForProject,
  createPackCopyText,
  editPlatformPack,
  finishActiveProgress,
  generatePlatformPackForProject,
  generatePrimaryContent,
  getActivePack,
  getLLMClientForState,
  getPackBlock,
  prepareSeedForProject,
  removeCharacterRepeater,
  resetProgress,
  runQuickChecksForProject,
  selectConceptForProject,
  setProgressStage,
  throwIfAborted,
  updateCharacterField,
} from "./ui/actions/generation-actions.js";
import {
  canCopyPlatformBlock,
  canCopyPlatformPack,
} from "./ui/platform-copy.js";
import {
  confirmCharacterRevision,
  discardCharacterRevision,
  proposeCharacterRevision,
  undoLastCharacterRevision,
} from "./ui/actions/editing-actions.js";
import {
  createProject,
  createProjectAutosaveService,
  deleteProjectFromState,
  dismissRecovery,
  exportSavedProject,
  importProjectIntoState,
  loadProjectIntoState,
  refreshSavedProjects,
  restoreProjectVersion,
  saveCurrentProject,
  saveProjectCheckpoint,
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

function syncAutosaveUi() {
  const status = appState.autosaveStatus || "idle";
  app.querySelectorAll("[data-save-status]").forEach((element) => {
    element.textContent = AUTOSAVE_LABELS[status] || status;
    element.className = `status-pill ${autosaveStatusClass(status)}`;
    element.dataset.status = status;
  });
}

const autosave = createProjectAutosaveService({
  onStatus(event) {
    if (event.projectId !== appState.project.id) return;
    appState.autosaveStatus = event.status;
    if (event.status === "saved") {
      appState.dirty = false;
      appState.autosaveError = "";
    } else if (event.status === "error") {
      appState.dirty = true;
      appState.autosaveError = toReadableError(event.error);
      render();
      return;
    }
    syncAutosaveUi();
  },
});

function scheduleAutosave() {
  try {
    assertProjectDocument(appState.project);
    appState.dirty = true;
    autosave.schedule(appState.project);
    syncAutosaveUi();
  } catch (error) {
    appState.autosaveStatus = "error";
    appState.autosaveError = toReadableError(error);
    render();
  }
}

function showError(error) {
  appState.error = toReadableError(error);
  appState.notice = "";
  render();
}

async function runTask(action, task) {
  if (taskRunner.isRunning(action) || appState.loading) return;
  appState.loading = true;
  appState.pendingAction = action;
  appState.error = "";
  appState.notice = "";
  render();

  try {
    await taskRunner.run(action, task);
  } catch (error) {
    if (error?.name !== "AbortError") {
      appState.error = toReadableError(error);
    }
  } finally {
    appState.loading = false;
    appState.pendingAction = "";
    render();
  }
}

function activateStage(stageId) {
  setProgressStage(appState, stageId, "active");
  appState.currentStep = "progress";
  render();
}

function completeStage(stageId) {
  setProgressStage(appState, stageId, "complete");
  render();
}

async function persistCheckpoint(createVersion) {
  try {
    await autosave.flush();
    appState.autosaveStatus = "saving";
    syncAutosaveUi();
    await saveProjectCheckpoint(appState, { createVersion });
    appState.autosaveStatus = "saved";
    appState.autosaveError = "";
  } catch (error) {
    appState.autosaveStatus = "error";
    appState.autosaveError = toReadableError(error);
  }
}

async function runDefaultPlatformStage(signal) {
  setProgressStage(appState, "check", "skipped");
  activateStage("platform");
  await generatePlatformPackForProject(appState, getLLMClient(), signal);
  throwIfAborted(signal);
  completeStage("platform");

  appendGenerationRecord(appState, "completed");
  appState.progressStatus = "complete";
  appState.currentStep = "result";
  appState.notice = "角色或故事与默认平台文本已生成；质量检查可按需运行。";
  render();
  await persistCheckpoint(true);
}

async function runPrimaryAndDefaultOutput(signal) {
  activateStage("generate");
  const outcome = await generatePrimaryContent(appState, getLLMClient(), signal);
  throwIfAborted(signal);
  completeStage("generate");

  if (outcome === "concepts") {
    appState.progressStatus = "awaiting-selection";
    appState.currentStep = "concepts";
    scheduleAutosave();
    return;
  }
  await runDefaultPlatformStage(signal);
}

async function beginGeneration(task) {
  if (taskRunner.isRunning("generation")) return;
  appState.loading = true;
  appState.pendingAction = "generation";
  appState.error = "";
  appState.notice = "";
  render();

  try {
    await taskRunner.run("generation", ({ signal }) => task(signal));
  } catch (error) {
    if (error?.name === "AbortError") {
      finishActiveProgress(appState, "cancelled");
      appendGenerationRecord(appState, "cancelled");
      appState.notice = "任务已取消。";
      scheduleAutosave();
    } else {
      finishActiveProgress(appState, "failed");
      appendGenerationRecord(appState, "failed");
      appState.error = toReadableError(error);
      scheduleAutosave();
    }
    appState.currentStep = "progress";
  } finally {
    appState.loading = false;
    appState.pendingAction = "";
    render();
  }
}

function startFromQuickInput(form, submitter) {
  let quickInput;
  let advancedBrief = null;
  try {
    quickInput = readQuickInput(form);
    if (appState.projectKind === "character") {
      advancedBrief = readCreativeBrief(form, "advanced-");
      appState.advancedBrief = advancedBrief;
    }
    appState.generationMode = submitter?.dataset.generationMode === "explore"
      ? "explore"
      : "direct";
    prepareSeedForProject(appState, quickInput, advancedBrief);
  } catch (error) {
    showError(error);
    return;
  }

  resetProgress(appState);
  activateStage("analyze");
  void beginGeneration(async (signal) => {
    const questions = await analyzeSeedForProject(
      appState,
      getLLMClient(),
      signal,
    );
    completeStage("analyze");
    if (questions.length > 0) {
      appState.progressStatus = "awaiting-input";
      appState.currentStep = "questions";
      scheduleAutosave();
      return;
    }
    await runPrimaryAndDefaultOutput(signal);
  });
}

function continueFromQuestions(form, submitter) {
  const answerMode = submitter?.dataset.answerMode || "current";
  let answers = answerMode === "skip"
    ? {}
    : readQuestionAnswers(form, appState.questions || []);
  if (answerMode === "recommended") {
    answers = { ...answers };
    for (const question of appState.questions.slice(0, 3)) {
      if (!answers[question.id]) answers[question.id] = question.recommended;
    }
  }
  appState.answers = answers;
  appState.currentStep = "progress";
  appState.progressStatus = "running";
  activateStage("generate");
  void beginGeneration((signal) => runPrimaryAndDefaultOutput(signal));
}

function updatePackIndicators(pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const lengthElement = Array.from(app.querySelectorAll("[data-pack-length]"))
    .find((element) => element.dataset.packLength === key);
  const validElement = Array.from(app.querySelectorAll("[data-pack-valid]"))
    .find((element) => element.dataset.packValid === key);
  const overElement = Array.from(app.querySelectorAll("[data-pack-over]"))
    .find((element) => element.dataset.packOver === key);
  const blockElement = validElement?.closest(".pack-block");
  const blockCopy = blockElement?.querySelector('[data-action="copy-pack-block"]');
  const wholeCopy = app.querySelector('[data-action="copy-pack"]');
  const overBy = block.maxLength === null
    ? 0
    : Math.max(0, block.currentLength - block.maxLength);
  const invalidReason = overBy > 0
    ? `已知超限 ${overBy} 字；保留全文，不会自动截断。`
    : !block.valid && block.text.trim().length === 0
      ? "必填字段为空。"
      : !block.valid
        ? "字段不满足已知平台规则。"
        : "";

  if (lengthElement) lengthElement.textContent = `${block.currentLength} 字`;
  if (validElement) {
    validElement.textContent = block.valid ? "有效" : "无效";
    validElement.className = `status-pill ${block.valid ? "status-pass" : "status-fail"}`;
  }
  if (overElement) {
    overElement.textContent = invalidReason;
    overElement.classList.toggle("is-visible", Boolean(invalidReason));
  }
  blockElement?.classList.toggle("pack-invalid", !block.valid);
  if (blockCopy) {
    const copyAllowed = canCopyPlatformBlock(appState, block);
    blockCopy.disabled = !copyAllowed;
    blockCopy.dataset.copyValid = String(copyAllowed);
  }
  if (wholeCopy) {
    const allValid = canCopyPlatformPack(appState, pack);
    wholeCopy.disabled = !allValid;
    wholeCopy.dataset.copyValid = String(allValid);
  }
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (appState.loading) return;

  if (form.dataset.form === "quick-input") {
    startFromQuickInput(form, event.submitter);
  } else if (form.dataset.form === "questions") {
    continueFromQuestions(form, event.submitter);
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

  if (target.dataset.characterPath) {
    try {
      const value = target.dataset.valueType === "lines"
        ? linesToArray(target.value)
        : target.value;
      updateCharacterField(appState, target.dataset.characterPath, value);
      scheduleAutosave();
    } catch (error) {
      showError(error);
    }
    return;
  }
  if (target.dataset.revisionInstruction) {
    appState.fieldInstructions[target.dataset.revisionInstruction] = target.value;
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
      scheduleAutosave();
    } catch (error) {
      showError(error);
    }
    return;
  }
  if (Object.prototype.hasOwnProperty.call(target.dataset, "projectTitle")) {
    try {
      setProjectTitle(appState, target.value);
      scheduleAutosave();
    } catch (error) {
      showError(error);
    }
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  if (appState.loading) return;

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
        await autosave.flush();
        await importProjectIntoState(appState, await file.text());
      } finally {
        target.value = "";
      }
    });
    return;
  }
  if (target.dataset.characterPath) render();
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  const { action } = button.dataset;

  if (action === "cancel-generation") {
    taskRunner.cancel("generation");
    return;
  }
  if (action === "cancel-current-request") {
    taskRunner.cancel(appState.pendingAction);
    return;
  }
  if (appState.loading) return;

  if (action === "go-home") {
    void autosave.flush().catch(() => {});
    appState.currentStep = "home";
    appState.error = "";
    appState.notice = "";
    render();
    return;
  }
  if (action === "create-character" || action === "create-story") {
    createProject(appState, action === "create-story" ? "story" : "character");
    render();
    return;
  }
  if (action === "open-library") {
    document.querySelector("#project-library")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (action === "choose-import") {
    app.querySelector("[data-import-file]")?.click();
    return;
  }
  if (action === "dismiss-recovery") {
    dismissRecovery(appState);
    render();
    return;
  }
  if (action === "recover-project" || action === "load-project") {
    const projectId = button.dataset.projectId;
    void runTask("load-project", async () => {
      await autosave.flush();
      await loadProjectIntoState(appState, projectId);
    });
    return;
  }
  if (action === "delete-project") {
    const project = appState.savedProjects.find(
      (item) => item.id === button.dataset.projectId,
    );
    if (!window.confirm(`确定删除“${project?.title || "未命名项目"}”及其历史版本吗？`)) return;
    void runTask("delete-project", () =>
      deleteProjectFromState(appState, button.dataset.projectId));
    return;
  }
  if (action === "back-to-create") {
    appState.currentStep = "create";
    appState.error = "";
    appState.notice = "";
    render();
    return;
  }
  if (action === "select-concept") {
    const concept = appState.project.concepts.find(
      (item) => item.id === button.dataset.conceptId,
    );
    if (!concept) {
      showError(new Error("找不到所选方向。"));
      return;
    }
    resetProgress(appState, ["analyze"]);
    activateStage("generate");
    void beginGeneration(async (signal) => {
      await selectConceptForProject(appState, concept, getLLMClient(), signal);
      completeStage("generate");
      await runDefaultPlatformStage(signal);
    });
    return;
  }
  if (action === "run-quick-check") {
    void runTask("quick-check", async ({ signal }) => {
      await runQuickChecksForProject(appState, getLLMClient(), signal);
      scheduleAutosave();
    });
    return;
  }
  if (action === "generate-platform-pack") {
    const flowId = button.dataset.packFlow;
    void runTask("generate-platform-pack", async ({ signal }) => {
      await generatePlatformPackForProject(
        appState,
        getLLMClient(),
        signal,
        flowId,
      );
      appState.notice = `“${flowId}”输入包已生成。`;
      scheduleAutosave();
    });
    return;
  }
  if (action === "go-field") {
    appState.activeFieldPath = button.dataset.fieldPath || "";
    render();
    requestAnimationFrame(() => scrollToFieldPath(appState.activeFieldPath));
    return;
  }
  if (action === "run-full-simulation") {
    void runTask("full-simulation", async ({ signal }) => {
      await runSimulationForProject(appState, getLLMClient(), signal);
      scheduleAutosave();
    });
    return;
  }
  if (action === "copy-pack-block") {
    const block = getPackBlock(
      appState,
      button.dataset.packFlow,
      button.dataset.packBlock,
    );
    if (!canCopyPlatformBlock(appState, block)) {
      showError(new Error("该字段无效，修正后才能复制。"));
      return;
    }
    void copyText(block.text).then(() => {
      appState.notice = `“${block.label}”已复制。`;
      render();
    }).catch(showError);
    return;
  }
  if (action === "copy-pack") {
    const pack = getActivePack(appState, button.dataset.packFlow);
    if (!canCopyPlatformPack(appState, pack)) {
      showError(new Error("输入包含有无效字段，修正后才能复制整包。"));
      return;
    }
    void copyText(createPackCopyText(pack)).then(() => {
      appState.notice = "平台文本整包已复制。";
      render();
    }).catch(showError);
    return;
  }
  if (action === "propose-revision") {
    const fieldPath = button.dataset.fieldPath;
    const instruction = String(appState.fieldInstructions[fieldPath] || "").trim();
    if (!instruction) {
      showError(new Error("请先填写这个字段的 AI 修改要求。"));
      return;
    }
    void runTask(`revision-${fieldPath}`, ({ signal }) =>
      proposeCharacterRevision(
        appState,
        fieldPath,
        instruction,
        getLLMClient(),
        signal,
      ));
    return;
  }
  if (action === "confirm-revision") {
    void runTask("confirm-revision", async () => {
      confirmCharacterRevision(appState);
      await persistCheckpoint(true);
    });
    return;
  }
  if (action === "discard-revision") {
    discardCharacterRevision(appState);
    render();
    return;
  }
  if (action === "undo-revision") {
    try {
      undoLastCharacterRevision(appState);
      scheduleAutosave();
      render();
    } catch (error) {
      showError(error);
    }
    return;
  }
  if (action === "add-repeater") {
    addCharacterRepeater(appState, button.dataset.repeater);
    scheduleAutosave();
    render();
    return;
  }
  if (action === "remove-repeater") {
    removeCharacterRepeater(
      appState,
      button.dataset.repeater,
      Number(button.dataset.index),
    );
    scheduleAutosave();
    render();
    return;
  }
  if (action === "save-project") {
    void runTask("save-project", async () => {
      await autosave.flush();
      await saveCurrentProject(appState);
    });
    return;
  }
  if (action === "restore-version") {
    void runTask("restore-version", async () => {
      await autosave.flush();
      await restoreProjectVersion(appState, button.dataset.versionId);
    });
    return;
  }
  if (action === "export-json" || action === "export-markdown") {
    const isJson = action === "export-json";
    void runTask(action, async () => {
      await autosave.flush();
      const content = await exportSavedProject(
        appState,
        isJson ? "json" : "markdown",
      );
      const extension = isJson ? "json" : "md";
      downloadText(
        content,
        createDownloadFilename(appState.project.title, extension),
        isJson
          ? "application/json;charset=utf-8"
          : "text/markdown;charset=utf-8",
      );
      appState.notice = `${isJson ? "JSON" : "Markdown"} 已导出。`;
    });
  }
});

render();
void refreshSavedProjects(appState)
  .then(() => render())
  .catch((error) => {
    appState.error = toReadableError(error);
    render();
  });
