import {
  applyFieldPatch,
  assertCharacterDraft,
  assertCreativeBrief,
  assertCreativeSeed,
  assertProjectDocument,
  assertStoryDraft,
  createId,
  getValueAtPath,
} from "../../contracts.js";
import {
  analyzeCreativeSeed,
  expandCharacter,
  generateCharacterFromSeed,
  generateConcepts,
  generateStoryDraft,
  generateWorldBible,
} from "../../generation/index.js";
import { withAbortSignal } from "../../llm/abortable-client.js";
import { createLLMClient } from "../../llm/openai-compatible-client.js";
import { createCoreFlowMockLLMClient } from "../../mock/index.js";
import {
  createMaoxiangPack,
  validatePlatformPack,
} from "../../platforms/maoxiang/index.js";
import { checkRules, runQuickDialogueTest } from "../../evaluation/index.js";
import { invalidateProject } from "../../workflow/index.js";
import { createGenerationProgress } from "../../app-state.js";
import {
  assertBriefRequirements,
  composeCreativeSeed,
  createProjectTitle,
} from "../forms.js";

function markChanged(state) {
  state.dirty = true;
  state.notice = "";
}

function createAnsweredStorySeed(state) {
  const answers = Object.fromEntries(
    Object.entries(state.answers || {}).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  );
  if (Object.keys(answers).length === 0) {
    return state.project.seed;
  }

  const seed = {
    text: [
      state.project.seed.text,
      `关键追问答案 JSON：\n${JSON.stringify(answers)}`,
    ].join("\n\n"),
  };
  assertCreativeSeed(seed);
  return seed;
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
  const error = new Error("任务已取消");
  error.name = "AbortError";
  throw error;
}

function readRevisionFieldPath(request) {
  const content = Array.isArray(request?.messages)
    ? request.messages.map((message) => String(message?.content || "")).join("\n")
    : "";
  return content.match(/唯一目标字段：([^\r\n]+)/u)?.[1]?.trim() || "";
}

function readRevisionInstruction(request) {
  const content = Array.isArray(request?.messages)
    ? request.messages.map((message) => String(message?.content || "")).join("\n")
    : "";
  return content.match(/定向修改要求：\s*([\s\S]*?)\s*只返回/u)?.[1]?.trim() || "细化表达";
}

function createMockRevisionAfter(before, instruction) {
  if (typeof before === "string") {
    return before.trim()
      ? `${before}\n（Mock 修改：${instruction}）`
      : `Mock 修改：${instruction}`;
  }
  if (Array.isArray(before) && before.every((item) => typeof item === "string")) {
    return before.length === 0
      ? [`Mock 修改：${instruction}`]
      : before.map((item, index) => index === 0 ? `${item}（Mock 修改：${instruction}）` : item);
  }
  throw new Error("Mock 字段修改仅支持文本或文本列表。");
}

export function createAppMockClient(state) {
  const baseClient = createCoreFlowMockLLMClient();
  return {
    async completeJson(request) {
      if (request?.task === "field-revision-proposal") {
        const fieldPath = readRevisionFieldPath(request);
        if (!fieldPath || !state.project.character) {
          throw new Error("Mock 字段修改缺少目标字段。");
        }
        const before = structuredClone(getValueAtPath(state.project.character, fieldPath));
        const instruction = readRevisionInstruction(request);
        return {
          fieldPath,
          before,
          after: createMockRevisionAfter(before, instruction),
          summary: `已按“${instruction}”生成单字段修改提案。`,
        };
      }
      return baseClient.completeJson(request);
    },
    completeText(request) {
      return baseClient.completeText(request);
    },
  };
}

export function getLLMClientForState(state, model) {
  return state.mode === "mock"
    ? createAppMockClient(state)
    : createLLMClient({ model });
}

export function resetProgress(state, completedStageIds = []) {
  const completed = new Set(completedStageIds);
  state.progress = createGenerationProgress().map((stage) => ({
    ...stage,
    status: completed.has(stage.id) ? "complete" : "pending",
  }));
  state.progressStatus = "running";
}

export function setProgressStage(state, stageId, status) {
  state.progress = state.progress.map((stage) =>
    stage.id === stageId ? { ...stage, status } : stage,
  );
}

export function finishActiveProgress(state, status) {
  let found = false;
  state.progress = state.progress.map((stage) => {
    if (!found && stage.status === "active") {
      found = true;
      return { ...stage, status };
    }
    return stage;
  });
  state.progressStatus = status === "cancelled" ? "cancelled" : "failed";
}

export function prepareSeedForProject(state, quickInput, advancedBrief) {
  const seed = composeCreativeSeed(quickInput, advancedBrief);
  assertCreativeSeed(seed);
  const nextProject = invalidateProject(
    {
      ...state.project,
      title: createProjectTitle(quickInput.idea, state.projectKind),
      seed,
      updatedAt: new Date().toISOString(),
    },
    "seed",
  );
  nextProject.seed = seed;
  assertProjectDocument(nextProject);
  state.project = nextProject;
  state.quickInput = { ...quickInput };
  state.questions = [];
  state.answers = {};
  state.selectedConceptId = null;
  state.quickDialogueReport = null;
  state.storyCheck = null;
  state.pendingRevision = null;
  state.revisionDiff = null;
  state.revisionHistory = [];
  markChanged(state);
}

export async function analyzeSeedForProject(state, llmClient, signal) {
  const result = await analyzeCreativeSeed(
    state.project.seed,
    llmClient,
    { signal },
  );
  throwIfAborted(signal);
  state.questions = result.questions.slice(0, 3);
  return state.questions;
}

async function deriveBriefForExploration(state, llmClient, signal) {
  if (state.advancedBrief) {
    try {
      assertBriefRequirements(state.advancedBrief);
      assertCreativeBrief(state.advancedBrief);
      return { title: state.project.title, brief: state.advancedBrief };
    } catch {
      // 高级表单不完整时由智能入口生成有效简报。
    }
  }
  const generated = await generateCharacterFromSeed(
    state.project.seed,
    state.answers,
    llmClient,
    { signal },
  );
  throwIfAborted(signal);
  return { title: generated.title, brief: generated.brief };
}

export async function generatePrimaryContent(state, llmClient, signal) {
  if (state.projectKind === "story") {
    const storySeed = createAnsweredStorySeed(state);
    const worldBible = await generateWorldBible(
      { seed: storySeed },
      llmClient,
      { signal },
    );
    throwIfAborted(signal);
    const storyDraft = await generateStoryDraft(
      { seed: storySeed, worldBible },
      llmClient,
      { signal },
    );
    throwIfAborted(signal);
    state.project = {
      ...state.project,
      title: storyDraft.title,
      worldBible,
      storyDraft,
      updatedAt: new Date().toISOString(),
    };
    assertProjectDocument(state.project);
    markChanged(state);
    return "generated";
  }

  if (state.generationMode === "explore") {
    const derived = await deriveBriefForExploration(state, llmClient, signal);
    const concepts = await generateConcepts(
      derived.brief,
      withAbortSignal(llmClient, signal),
    );
    throwIfAborted(signal);
    state.project = {
      ...state.project,
      title: derived.title,
      brief: derived.brief,
      concepts,
      selectedConceptId: null,
      character: null,
      updatedAt: new Date().toISOString(),
    };
    assertProjectDocument(state.project);
    state.selectedConceptId = null;
    markChanged(state);
    return "concepts";
  }

  const generated = await generateCharacterFromSeed(
    state.project.seed,
    state.answers,
    llmClient,
    { signal },
  );
  throwIfAborted(signal);
  state.project = {
    ...state.project,
    title: generated.title,
    brief: generated.brief,
    concepts: [],
    selectedConceptId: null,
    character: generated.character,
    updatedAt: new Date().toISOString(),
  };
  assertProjectDocument(state.project);
  markChanged(state);
  return "generated";
}

export async function selectConceptForProject(state, concept, llmClient, signal) {
  const character = await expandCharacter(
    concept,
    state.project.brief,
    withAbortSignal(llmClient, signal),
  );
  throwIfAborted(signal);
  state.project = {
    ...state.project,
    selectedConceptId: concept.id,
    character,
    updatedAt: new Date().toISOString(),
  };
  assertProjectDocument(state.project);
  state.selectedConceptId = concept.id;
  markChanged(state);
}

export async function runQuickChecksForProject(state, llmClient, signal) {
  if (state.project.character) {
    const ruleReport = checkRules(state.project.character);
    const quickDialogueReport = await runQuickDialogueTest(
      state.project.character,
      llmClient,
      { signal },
    );
    throwIfAborted(signal);
    state.project = {
      ...state.project,
      ruleReport,
      updatedAt: new Date().toISOString(),
    };
    state.quickDialogueReport = quickDialogueReport;
    state.storyCheck = null;
  } else if (state.project.storyDraft) {
    assertStoryDraft(state.project.storyDraft);
    state.storyCheck = {
      status: "pass",
      message: "故事结构已通过共享契约校验，包含正好 8 个关键节点。",
    };
    state.quickDialogueReport = null;
  } else {
    throw new Error("请先生成角色或故事。");
  }
  assertProjectDocument(state.project);
  markChanged(state);
}

export async function generatePlatformPackForProject(state, llmClient, signal) {
  const flowId = state.projectKind === "story"
    ? "editor_open_story"
    : "editor_character";
  const pack = await createMaoxiangPack(
    state.project,
    flowId,
    llmClient,
    { signal },
  );
  throwIfAborted(signal);
  state.project = {
    ...state.project,
    platformPacks: [
      ...state.project.platformPacks.filter((item) => item.flowId !== flowId),
      pack,
    ],
    updatedAt: new Date().toISOString(),
  };
  assertProjectDocument(state.project);
  markChanged(state);
  return pack;
}

export function appendGenerationRecord(state, status) {
  const createdAt = new Date().toISOString();
  state.project = {
    ...state.project,
    generationRecords: [
      ...(state.project.generationRecords || []),
      {
        id: createId("generation"),
        task: `${state.projectKind}-ui-workflow`,
        target: state.projectKind,
        status,
        createdAt,
      },
    ],
    updatedAt: createdAt,
  };
  assertProjectDocument(state.project);
  markChanged(state);
}

export function updateCharacterField(state, path, value) {
  const nextCharacter = applyFieldPatch(state.project.character, {
    fieldPath: path,
    value,
  });
  const timestamp = new Date().toISOString();
  nextCharacter.meta.updatedAt = timestamp;
  assertCharacterDraft(nextCharacter);

  const nextProject = invalidateProject(state.project, "character");
  nextProject.character = nextCharacter;
  nextProject.updatedAt = timestamp;
  assertProjectDocument(nextProject);
  state.project = nextProject;
  state.quickDialogueReport = null;
  state.storyCheck = null;
  state.pendingRevision = null;
  state.revisionDiff = null;
  state.activeFieldPath = path;
  markChanged(state);
}

export function addCharacterRepeater(state, kind) {
  if (kind === "stages") {
    updateCharacterField(state, "relationship.stages", [
      ...state.project.character.relationship.stages,
      { name: "新阶段", trigger: "", behavior: "" },
    ]);
  } else if (kind === "examples") {
    updateCharacterField(state, "dialogueStyle.examples", [
      ...state.project.character.dialogueStyle.examples,
      { user: "", character: "" },
    ]);
  }
}

export function removeCharacterRepeater(state, kind, index) {
  if (kind === "stages") {
    updateCharacterField(
      state,
      "relationship.stages",
      state.project.character.relationship.stages.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  } else if (kind === "examples") {
    updateCharacterField(
      state,
      "dialogueStyle.examples",
      state.project.character.dialogueStyle.examples.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  }
}

export function editPlatformPack(state, flowId, blockId, text) {
  const packIndex = state.project.platformPacks.findIndex(
    (pack) => pack.flowId === flowId,
  );
  if (packIndex === -1) return null;
  const currentPack = state.project.platformPacks[packIndex];
  const pack = validatePlatformPack({
    ...currentPack,
    blocks: currentPack.blocks.map((block) =>
      block.id === blockId ? { ...block, text } : block,
    ),
  });
  state.project.platformPacks = state.project.platformPacks.map(
    (item, index) => index === packIndex ? pack : item,
  );
  state.project.updatedAt = new Date().toISOString();
  assertProjectDocument(state.project);
  markChanged(state);
  return { pack, block: pack.blocks.find((item) => item.id === blockId) || null };
}

export function getPackBlock(state, flowId, blockId) {
  return state.project.platformPacks.find((pack) => pack.flowId === flowId)
    ?.blocks.find((block) => block.id === blockId) || null;
}

export function getActivePack(state) {
  const flowId = state.projectKind === "story"
    ? "editor_open_story"
    : "editor_character";
  return state.project.platformPacks.find((pack) => pack.flowId === flowId) || null;
}

export function createPackCopyText(pack) {
  return pack.blocks
    .map((block) => `${block.label}\n${block.text}`)
    .join("\n\n");
}
