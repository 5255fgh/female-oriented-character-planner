import "./styles.css";

import {
  applyFieldPatch,
  assertCharacterDraft,
  assertCharacterProject,
  assertCreativeBrief,
  countUnicodeCharacters,
  getValueAtPath,
} from "./contracts.js";
import { checkRules } from "./evaluation/rule-checker.js";
import { runDialogueTest } from "./evaluation/dialogue-tester.js";
import { expandCharacter } from "./generation/character-generator.js";
import { generateConcepts } from "./generation/concept-generator.js";
import { regenerateField } from "./generation/field-regenerator.js";
import { createLLMClient } from "./llm/openai-compatible-client.js";
import { createMockLLMClient } from "./mock/mock-llm-client.js";
import { MAOXIANG_FLOWS } from "./platforms/maoxiang/config.js";
import { generateMaoxiangPack } from "./platforms/maoxiang/pack-generator.js";
import { validatePlatformPack } from "./platforms/maoxiang/pack-validator.js";
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
} from "./storage/index.js";
import {
  appState,
  markProjectChanged,
  replaceCurrentProject,
  resetCurrentProject,
} from "./app-state.js";
import { createDownloadFilename, downloadText } from "./ui/download.js";
import {
  copyText,
  linesToArray,
  scrollToFieldPath,
  toReadableError,
} from "./ui/dom.js";
import { assertBriefRequirements, readCreativeBrief } from "./ui/forms.js";
import { renderApp } from "./ui/renderers.js";

const app = document.querySelector("#app");
const model = import.meta.env.VITE_LLM_MODEL || "deepseek-v4-flash";

const MOCK_SCENARIO_ID_MAP = {
  "explicit-boundary": "refusal",
  silence: "short_replies",
  accusation: "motive_question",
  "daily-care": "low_mood",
  "repair-after-conflict": "user_approaches",
  jealousy: "important_other",
  "dangerous-choice": "out_of_character_request",
  "user-failure": "long_conversation_progress",
};

function render() {
  app.innerHTML = renderApp(appState, { model });
}

function canVisitStep(step) {
  if (step <= 1) {
    return true;
  }
  if (step === 2) {
    return appState.project.concepts.length === 3;
  }
  if (step <= 4) {
    return Boolean(appState.project.character);
  }
  if (step === 5) {
    return Boolean(appState.project.ruleReport && appState.project.simulationReport);
  }
  return appState.project.platformPacks.length > 0;
}

function syncStepNavigation() {
  app.querySelectorAll('[data-action="go-step"][data-step]').forEach((button) => {
    button.disabled = appState.loading || !canVisitStep(Number(button.dataset.step));
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
  if (helper) {
    helper.textContent = "请先保存当前修改，再导出最新版本。";
  }
}

function showError(error) {
  appState.error = toReadableError(error);
  appState.notice = "";
  render();
}

async function runTask(action, task) {
  if (appState.loading) {
    return;
  }

  appState.loading = true;
  appState.pendingAction = action;
  appState.error = "";
  appState.notice = "";
  render();

  try {
    await task();
  } catch (error) {
    appState.error = toReadableError(error);
  } finally {
    appState.loading = false;
    appState.pendingAction = "";
    render();
  }
}

function findRequestedFieldPath(request) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const content = messages
    .map((message) => (typeof message?.content === "string" ? message.content : ""))
    .join("\n");
  return content.match(/唯一允许重写的字段路径：([^\r\n]+)/)?.[1]?.trim() || "";
}

function findRequestedInstruction(request) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const content = messages
    .map((message) => (typeof message?.content === "string" ? message.content : ""))
    .join("\n");
  return content.match(/定向修改要求：\s*([\s\S]*?)\s*只返回 \{"fieldPath"/)?.[1]?.trim() || "按当前方向细化";
}

function createCompatibleMockValue(currentValue, instruction, fallbackValue) {
  if (typeof currentValue === "string") {
    const current = currentValue.trim();
    return current
      ? `${current}\n（Mock 已按要求调整：${instruction}）`
      : `Mock 调整结果：${instruction}`;
  }

  if (Array.isArray(currentValue) && currentValue.every((item) => typeof item === "string")) {
    if (currentValue.length === 0) {
      return [`Mock 调整结果：${instruction}`];
    }
    return currentValue.map((item, index) =>
      index === 0 ? `${item}（Mock 已按要求调整：${instruction}）` : item,
    );
  }

  return fallbackValue;
}

function adaptMockDialogueResponse(response) {
  const wrapped =
    response !== null &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    Object.prototype.hasOwnProperty.call(response, "report");
  const report = wrapped ? response.report : response;

  if (!report || !Array.isArray(report.scenarios)) {
    return response;
  }

  const adaptedReport = {
    ...report,
    scenarios: report.scenarios.map((scenario) => ({
      ...scenario,
      scenarioId: MOCK_SCENARIO_ID_MAP[scenario.scenarioId] || scenario.scenarioId,
    })),
  };
  return wrapped ? { ...response, report: adaptedReport } : adaptedReport;
}

function createAppMockClient() {
  const baseClient = createMockLLMClient();

  return {
    completeText(request) {
      return baseClient.completeText(request);
    },
    async completeJson(request) {
      const response = await baseClient.completeJson(request);

      // 已锁定 Mock 使用较早的场景标识；仅在应用接线层映射到评估器固定集合。
      if (request.task === "dialogue-evaluation") {
        return adaptMockDialogueResponse(response);
      }

      // 已锁定 Mock 只有一个固定补丁；其他字段保持同一接口形状以便完整演示。
      if (request.task === "field-regeneration") {
        const requestedPath = findRequestedFieldPath(request);
        if (requestedPath && response.fieldPath !== requestedPath) {
          const currentValue = getValueAtPath(appState.project.character, requestedPath);
          return {
            fieldPath: requestedPath,
            value: createCompatibleMockValue(
              currentValue,
              findRequestedInstruction(request),
              response.value,
            ),
          };
        }
      }

      return response;
    },
  };
}

function getLLMClient() {
  return appState.mode === "mock"
    ? createAppMockClient()
    : createLLMClient({ model });
}

async function refreshSavedProjects() {
  appState.savedProjects = await listProjects();
}

async function refreshVersions() {
  const isStored = appState.savedProjects.some(
    (project) => project.id === appState.project.id,
  );
  appState.versions = isStored ? await listVersions(appState.project.id) : [];
}

function goToField(fieldPath) {
  appState.activeFieldPath = fieldPath;
  appState.currentStep = 3;
  appState.error = "";
  appState.notice = "";
  render();
  requestAnimationFrame(() => scrollToFieldPath(fieldPath));
}

function invalidateCharacterOutputs() {
  appState.project.ruleReport = null;
  appState.project.simulationReport = null;
  appState.project.platformPacks = [];
}

function invalidateBriefOutputs() {
  appState.project.concepts = [];
  appState.project.selectedConceptId = "";
  appState.project.character = null;
  invalidateCharacterOutputs();
  appState.selectedConceptId = "";
  appState.activeFieldPath = "";
  appState.fieldInstructions = {};
}

function updateCharacterField(path, value) {
  const nextCharacter = applyFieldPatch(appState.project.character, {
    fieldPath: path,
    value,
  });
  assertCharacterDraft(nextCharacter);
  appState.project.character = nextCharacter;
  invalidateCharacterOutputs();
  markProjectChanged();
  syncStepNavigation();
}

function updateBriefFromForm(form) {
  const brief = readCreativeBrief(form);
  const briefChanged = JSON.stringify(brief) !== JSON.stringify(appState.project.brief);
  appState.project.brief = brief;
  const title = form.elements.projectTitle?.value;
  if (typeof title === "string") {
    appState.project.title = title;
  }
  if (briefChanged) {
    invalidateBriefOutputs();
  }
  markProjectChanged();
  syncStepNavigation();
}

function addRepeater(kind) {
  if (kind === "stages") {
    const stages = appState.project.character.relationship.stages;
    updateCharacterField("relationship.stages", [
      ...stages,
      { name: "新阶段", trigger: "", behavior: "" },
    ]);
  } else if (kind === "examples") {
    const examples = appState.project.character.dialogueStyle.examples;
    updateCharacterField("dialogueStyle.examples", [
      ...examples,
      { user: "", character: "" },
    ]);
  }
  render();
}

function removeRepeater(kind, index) {
  if (kind === "stages") {
    const stages = appState.project.character.relationship.stages.filter(
      (_, itemIndex) => itemIndex !== index,
    );
    updateCharacterField("relationship.stages", stages);
  } else if (kind === "examples") {
    const examples = appState.project.character.dialogueStyle.examples.filter(
      (_, itemIndex) => itemIndex !== index,
    );
    updateCharacterField("dialogueStyle.examples", examples);
  }
  render();
}

function prepareEditedPack(pack, blockId, text) {
  const blocks = pack.blocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }
    const currentLength = countUnicodeCharacters(text);
    return {
      ...block,
      text,
      currentLength,
      valid: block.maxLength === null || currentLength <= block.maxLength,
    };
  });
  const validated = validatePlatformPack({ ...pack, blocks });
  const flow = MAOXIANG_FLOWS[validated.flowId];

  return {
    ...validated,
    blocks: validated.blocks.map((block) => ({
      ...block,
      valid:
        block.valid &&
        (!flow[block.id]?.required || countUnicodeCharacters(block.text) > 0),
    })),
  };
}

function updatePackIndicators(pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const lengthElement = Array.from(document.querySelectorAll("[data-pack-length]"))
    .find((element) => element.dataset.packLength === key);
  const validElement = Array.from(document.querySelectorAll("[data-pack-valid]"))
    .find((element) => element.dataset.packValid === key);
  const overElement = Array.from(document.querySelectorAll("[data-pack-over]"))
    .find((element) => element.dataset.packOver === key);
  const overBy = block.maxLength === null
    ? 0
    : Math.max(0, block.currentLength - block.maxLength);

  if (lengthElement) {
    lengthElement.textContent = `当前 ${block.currentLength} 字`;
  }
  if (validElement) {
    validElement.textContent = block.valid ? "有效" : "需调整";
    validElement.className = `status-pill ${block.valid ? "status-pass" : "status-fail"}`;
  }
  if (overElement) {
    overElement.textContent = overBy > 0 ? `超出 ${overBy} 字` : "";
    overElement.classList.toggle("is-visible", overBy > 0);
  }
}

function handlePackInput(target) {
  const flowId = target.dataset.packFlow;
  const blockId = target.dataset.packBlock;
  const packIndex = appState.project.platformPacks.findIndex(
    (pack) => pack.flowId === flowId,
  );
  if (packIndex === -1) {
    return;
  }

  const pack = prepareEditedPack(
    appState.project.platformPacks[packIndex],
    blockId,
    target.value,
  );
  appState.project.platformPacks = appState.project.platformPacks.map(
    (item, index) => (index === packIndex ? pack : item),
  );
  markProjectChanged();
  const block = pack.blocks.find((item) => item.id === blockId);
  if (block) {
    updatePackIndicators(pack, block);
  }
}

function getPackBlock(flowId, blockId) {
  return appState.project.platformPacks
    .find((pack) => pack.flowId === flowId)
    ?.blocks.find((block) => block.id === blockId);
}

function assertProjectReadyToSave() {
  appState.project.title = appState.project.title.trim();
  if (!appState.project.title) {
    throw new Error("请填写项目标题后再保存。" );
  }
  if (appState.project.platformPacks.length === 0) {
    throw new Error("请先生成猫箱输入包后再保存。" );
  }
  appState.project.selectedConceptId = appState.selectedConceptId;
  assertCharacterProject(appState.project);
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();
  if (form.dataset.form === "new-project") {
    const title = String(new FormData(form).get("title") || "").trim();
    if (!title) {
      showError(new Error("请填写项目标题。" ));
      return;
    }
    resetCurrentProject(title);
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
      showError(new Error("请填写项目标题。" ));
      return;
    }

    void runTask("generate-concepts", async () => {
      const concepts = await generateConcepts(brief, getLLMClient());
      appState.project.title = projectTitle;
      appState.project.brief = brief;
      appState.project.concepts = concepts;
      appState.project.selectedConceptId = "";
      appState.project.character = null;
      appState.project.ruleReport = null;
      appState.project.simulationReport = null;
      appState.project.platformPacks = [];
      appState.selectedConceptId = "";
      appState.versions = [];
      appState.currentStep = 2;
      markProjectChanged();
    });
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.form?.dataset.form === "creative-brief") {
    updateBriefFromForm(target.form);
    return;
  }

  if (target.dataset.characterPath) {
    try {
      const value = target.dataset.valueType === "lines"
        ? linesToArray(target.value)
        : target.value;
      updateCharacterField(target.dataset.characterPath, value);
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
      handlePackInput(target);
    } catch (error) {
      showError(error);
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(target.dataset, "projectTitle")) {
    appState.project.title = target.value;
    markProjectChanged();
    syncUnsavedProjectUi();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(target.dataset, "appMode")) {
    appState.mode = target.value === "real" ? "real" : "mock";
    appState.error = "";
    appState.notice = "运行模式已切换，当前项目内容保持不变。";
    render();
    return;
  }

  if (Object.prototype.hasOwnProperty.call(target.dataset, "importFile")) {
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    void runTask("import-project", async () => {
      try {
        const imported = await importProjectJson(await file.text());
        replaceCurrentProject(imported);
        appState.currentStep = 6;
        await refreshSavedProjects();
        await refreshVersions();
        appState.notice = "JSON 项目已导入并另存为新项目。";
      } finally {
        target.value = "";
      }
    });
  }
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled || appState.loading) {
    return;
  }

  const { action } = button.dataset;
  if (action === "go-step") {
    const step = Number(button.dataset.step);
    if (!canVisitStep(step)) {
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
    const concept = appState.project.concepts.find(
      (item) => item.id === button.dataset.conceptId,
    );
    if (!concept) {
      showError(new Error("找不到所选候选。" ));
      return;
    }
    void runTask(`expand-${concept.id}`, async () => {
      const character = await expandCharacter(
        concept,
        appState.project.brief,
        getLLMClient(),
      );
      appState.selectedConceptId = concept.id;
      appState.project.selectedConceptId = concept.id;
      appState.project.character = character;
      appState.project.ruleReport = null;
      appState.project.simulationReport = null;
      appState.project.platformPacks = [];
      appState.currentStep = 3;
      markProjectChanged();
    });
    return;
  }

  if (action === "regenerate-field") {
    const fieldPath = button.dataset.fieldPath;
    const instruction = (appState.fieldInstructions[fieldPath] || "").trim();
    if (!instruction) {
      showError(new Error("请先填写此字段的修改要求。" ));
      return;
    }
    void runTask(`regenerate-${fieldPath}`, async () => {
      const patch = await regenerateField(
        appState.project.character,
        fieldPath,
        instruction,
        getLLMClient(),
      );
      const nextCharacter = applyFieldPatch(appState.project.character, patch);
      assertCharacterDraft(nextCharacter);
      appState.project.character = nextCharacter;
      invalidateCharacterOutputs();
      appState.activeFieldPath = fieldPath;
      markProjectChanged();
      appState.notice = `已只更新字段 ${fieldPath}。`;
    });
    return;
  }

  if (action === "add-repeater") {
    addRepeater(button.dataset.repeater);
    return;
  }

  if (action === "remove-repeater") {
    removeRepeater(button.dataset.repeater, Number(button.dataset.index));
    return;
  }

  if (action === "run-rules") {
    void runTask("run-rules", async () => {
      appState.project.ruleReport = checkRules(appState.project.character);
      markProjectChanged();
      appState.notice = "规则检查已完成。";
    });
    return;
  }

  if (action === "run-simulation") {
    void runTask("run-simulation", async () => {
      appState.project.simulationReport = await runDialogueTest(
        appState.project.character,
        getLLMClient(),
      );
      markProjectChanged();
      appState.notice = "8 场景模拟已完成。";
    });
    return;
  }

  if (action === "generate-pack") {
    void runTask("generate-pack", async () => {
      const flowId = appState.project.brief.outputMode;
      const pack = await generateMaoxiangPack(
        appState.project.character,
        flowId,
        getLLMClient(),
      );
      appState.project.platformPacks = [
        ...appState.project.platformPacks.filter((item) => item.flowId !== flowId),
        pack,
      ];
      markProjectChanged();
      appState.notice = "猫箱输入包已生成，可继续手工编辑。";
    });
    return;
  }

  if (action === "copy-pack-block") {
    const block = getPackBlock(button.dataset.packFlow, button.dataset.packBlock);
    if (!block) {
      showError(new Error("找不到要复制的输入包字段。" ));
      return;
    }
    void runTask(`copy-${block.id}`, async () => {
      await copyText(block.text);
      appState.notice = `“${block.label}”已复制。`;
    });
    return;
  }

  if (action === "save-project") {
    void runTask("save-project", async () => {
      assertProjectReadyToSave();
      const saved = await saveProject(appState.project);
      replaceCurrentProject(saved);
      appState.currentStep = 6;
      await refreshSavedProjects();
      await refreshVersions();
      appState.notice = "项目已保存，并创建了一个历史版本。";
    });
    return;
  }

  if (action === "load-project") {
    void runTask("load-project", async () => {
      const project = await getProject(button.dataset.projectId);
      if (!project) {
        throw new Error("项目不存在或已被删除。" );
      }
      replaceCurrentProject(project);
      appState.currentStep = 3;
      await refreshSavedProjects();
      await refreshVersions();
      appState.notice = "已打开本地项目。";
    });
    return;
  }

  if (action === "delete-project") {
    const project = appState.savedProjects.find(
      (item) => item.id === button.dataset.projectId,
    );
    const confirmed = window.confirm(
      `确定删除“${project?.title || "未命名项目"}”及其历史版本吗？`,
    );
    if (!confirmed) {
      return;
    }
    void runTask("delete-project", async () => {
      await deleteProject(button.dataset.projectId);
      if (appState.project.id === button.dataset.projectId) {
        resetCurrentProject();
        appState.currentStep = 0;
      }
      await refreshSavedProjects();
      await refreshVersions();
      appState.notice = "项目及其历史版本已删除。";
    });
    return;
  }

  if (action === "restore-version") {
    void runTask("restore-version", async () => {
      const restored = await restoreVersion(
        appState.project.id,
        button.dataset.versionId,
      );
      replaceCurrentProject(restored);
      appState.currentStep = 6;
      await refreshSavedProjects();
      await refreshVersions();
      appState.notice = "历史版本已恢复，并保留了恢复后的新版本。";
    });
    return;
  }

  if (action === "export-json" || action === "export-markdown") {
    const isStored = appState.savedProjects.some(
      (project) => project.id === appState.project.id,
    );
    if (appState.dirty || !isStored) {
      showError(new Error("请先保存当前修改，再导出最新版本。"));
      return;
    }
    const isJson = action === "export-json";
    void runTask(action, async () => {
      const content = isJson
        ? await exportProjectJson(appState.project.id)
        : await exportProjectMarkdown(appState.project.id);
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

  if (action === "choose-import") {
    app.querySelector("[data-import-file]")?.click();
  }
});

render();
void runTask("load-projects", async () => {
  await refreshSavedProjects();
});
