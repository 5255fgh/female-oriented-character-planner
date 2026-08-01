import {
  applyFieldPatch,
  assertCharacterDraft,
  getValueAtPath,
} from "../../contracts.js";
import { expandCharacter } from "../../generation/character-generator.js";
import { generateConcepts } from "../../generation/concept-generator.js";
import { regenerateField } from "../../generation/field-regenerator.js";
import { createLLMClient } from "../../llm/openai-compatible-client.js";
import { createMockLLMClient } from "../../mock/mock-llm-client.js";
import { generateMaoxiangPack } from "../../platforms/maoxiang/pack-generator.js";
import { validatePlatformPack } from "../../platforms/maoxiang/pack-validator.js";
import { invalidateProject } from "../../workflow/invalidation.js";
import { readCreativeBrief } from "../forms.js";

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

function markChanged(state) {
  state.dirty = true;
  state.notice = "";
}

function findRequestedFieldPath(request) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const content = messages.map((message) =>
    typeof message?.content === "string" ? message.content : ""
  ).join("\n");
  return content.match(/唯一允许重写的字段路径：([^\r\n]+)/)?.[1]?.trim() || "";
}

function findRequestedInstruction(request) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const content = messages.map((message) =>
    typeof message?.content === "string" ? message.content : ""
  ).join("\n");
  return content.match(/定向修改要求：\s*([\s\S]*?)\s*只返回 \{"fieldPath"/)?.[1]?.trim() || "按当前方向细化";
}

function createCompatibleMockValue(currentValue, instruction, fallbackValue) {
  if (typeof currentValue === "string") {
    const current = currentValue.trim();
    return current ? `${current}\n（Mock 已按要求调整：${instruction}）` : `Mock 调整结果：${instruction}`;
  }
  if (Array.isArray(currentValue) && currentValue.every((item) => typeof item === "string")) {
    if (currentValue.length === 0) return [`Mock 调整结果：${instruction}`];
    return currentValue.map((item, index) =>
      index === 0 ? `${item}（Mock 已按要求调整：${instruction}）` : item
    );
  }
  return fallbackValue;
}

function adaptMockDialogueResponse(response) {
  const wrapped = response !== null && typeof response === "object" &&
    !Array.isArray(response) && Object.prototype.hasOwnProperty.call(response, "report");
  const report = wrapped ? response.report : response;
  if (!report || !Array.isArray(report.scenarios)) return response;
  const adaptedReport = {
    ...report,
    scenarios: report.scenarios.map((scenario) => ({
      ...scenario,
      scenarioId: MOCK_SCENARIO_ID_MAP[scenario.scenarioId] || scenario.scenarioId,
    })),
  };
  return wrapped ? { ...response, report: adaptedReport } : adaptedReport;
}

export function createAppMockClient(state) {
  const baseClient = createMockLLMClient();
  return {
    completeText(request) {
      return baseClient.completeText(request);
    },
    async completeJson(request) {
      const response = await baseClient.completeJson(request);
      if (request.task === "dialogue-evaluation") return adaptMockDialogueResponse(response);
      if (request.task === "field-regeneration") {
        const requestedPath = findRequestedFieldPath(request);
        if (requestedPath && response.fieldPath !== requestedPath) {
          const currentValue = getValueAtPath(state.project.character, requestedPath);
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

export function getLLMClientForState(state, model) {
  return state.mode === "mock" ? createAppMockClient(state) : createLLMClient({ model });
}

export function invalidateCharacterOutputs(state) {
  state.project = invalidateProject(state.project, "character");
}

export function invalidateBriefOutputs(state) {
  state.project = invalidateProject(state.project, "brief");
  state.selectedConceptId = "";
  state.activeFieldPath = "";
  state.fieldInstructions = {};
}

export function updateCharacterField(state, path, value) {
  const nextCharacter = applyFieldPatch(state.project.character, { fieldPath: path, value });
  assertCharacterDraft(nextCharacter);
  state.project.character = nextCharacter;
  invalidateCharacterOutputs(state);
  markChanged(state);
}

export function updateBriefFromForm(state, form) {
  const brief = readCreativeBrief(form);
  const briefChanged = JSON.stringify(brief) !== JSON.stringify(state.project.brief);
  state.project.brief = brief;
  const title = form.elements.projectTitle?.value;
  if (typeof title === "string") state.project.title = title;
  if (briefChanged) invalidateBriefOutputs(state);
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
      state.project.character.relationship.stages.filter((_, itemIndex) => itemIndex !== index),
    );
  } else if (kind === "examples") {
    updateCharacterField(
      state,
      "dialogueStyle.examples",
      state.project.character.dialogueStyle.examples.filter((_, itemIndex) => itemIndex !== index),
    );
  }
}

function prepareEditedPack(pack, blockId, text) {
  const blocks = pack.blocks.map((block) => {
    if (block.id !== blockId) return block;
    return {
      ...block,
      text,
    };
  });
  return validatePlatformPack({ ...pack, blocks });
}

export function editPlatformPack(state, flowId, blockId, text) {
  const packIndex = state.project.platformPacks.findIndex((pack) => pack.flowId === flowId);
  if (packIndex === -1) return null;
  const pack = prepareEditedPack(state.project.platformPacks[packIndex], blockId, text);
  state.project.platformPacks = state.project.platformPacks.map(
    (item, index) => index === packIndex ? pack : item,
  );
  markChanged(state);
  return { pack, block: pack.blocks.find((item) => item.id === blockId) || null };
}

export function getPackBlock(state, flowId, blockId) {
  return state.project.platformPacks.find((pack) => pack.flowId === flowId)
    ?.blocks.find((block) => block.id === blockId);
}

export async function generateConceptsForProject(state, brief, projectTitle, llmClient) {
  const concepts = await generateConcepts(brief, llmClient);
  state.project.title = projectTitle;
  state.project.brief = brief;
  state.project.concepts = concepts;
  state.project.selectedConceptId = "";
  state.project.character = null;
  invalidateCharacterOutputs(state);
  state.selectedConceptId = "";
  state.versions = [];
  state.currentStep = 2;
  markChanged(state);
}

export async function expandCharacterForProject(state, concept, llmClient) {
  const character = await expandCharacter(concept, state.project.brief, llmClient);
  state.selectedConceptId = concept.id;
  state.project.selectedConceptId = concept.id;
  state.project.character = character;
  invalidateCharacterOutputs(state);
  state.currentStep = 3;
  markChanged(state);
}

export async function regenerateCharacterField(state, fieldPath, instruction, llmClient) {
  const patch = await regenerateField(
    state.project.character,
    fieldPath,
    instruction,
    llmClient,
  );
  const nextCharacter = applyFieldPatch(state.project.character, patch);
  assertCharacterDraft(nextCharacter);
  state.project.character = nextCharacter;
  invalidateCharacterOutputs(state);
  state.activeFieldPath = fieldPath;
  markChanged(state);
  state.notice = `已只更新字段 ${fieldPath}。`;
}

export async function generatePackForProject(state, llmClient) {
  const flowId = state.project.brief.outputMode;
  const pack = await generateMaoxiangPack(state.project.character, flowId, llmClient);
  state.project.platformPacks = [
    ...state.project.platformPacks.filter((item) => item.flowId !== flowId),
    pack,
  ];
  markChanged(state);
  state.notice = "猫箱输入包已生成，可继续手工编辑。";
}
