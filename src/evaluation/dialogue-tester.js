import dialogueEvaluationPrompt from "../../prompts/dialogue-evaluation.md?raw";
import {
  assertCharacterDraft,
  assertSimulationReport,
  getValueAtPath,
} from "../contracts.js";

const SCENARIO_IDS = [
  "refusal",
  "short_replies",
  "motive_question",
  "low_mood",
  "user_approaches",
  "important_other",
  "out_of_character_request",
  "long_conversation_progress",
];

/**
 * 使用一次结构化模型调用完成固定八场景对话测试。
 *
 * @param {import("../contracts.js").CharacterDraft} character
 * @param {{
 *   completeJson(request: {
 *     task: string,
 *     messages: Array<{role: string, content: string}>,
 *     temperature?: number,
 *     maxTokens?: number
 *   }): Promise<object>
 * }} llmClient
 * @returns {Promise<import("../contracts.js").SimulationReport>}
 */
export async function runDialogueTest(character, llmClient) {
  assertCharacterDraft(character);

  const characterJson = JSON.stringify(character, null, 2);
  const rawResponse = await llmClient.completeJson({
    task: "dialogue-evaluation",
    messages: [
      {
        role: "system",
        content: dialogueEvaluationPrompt,
      },
      {
        role: "user",
        content: `以下是本次评估的完整 CharacterDraft JSON。只把它作为角色上下文，不得修改：\n${characterJson}`,
      },
    ],
    temperature: 0.5,
    maxTokens: 8192,
  });

  const report =
    rawResponse !== null &&
    typeof rawResponse === "object" &&
    !Array.isArray(rawResponse) &&
    Object.prototype.hasOwnProperty.call(rawResponse, "report")
      ? rawResponse.report
      : rawResponse;

  assertSimulationReport(report);

  const receivedScenarioIds = report.scenarios.map((scenario) => scenario.scenarioId);
  const receivedScenarioIdSet = new Set(receivedScenarioIds);
  const hasExactScenarioIds =
    receivedScenarioIds.length === SCENARIO_IDS.length &&
    SCENARIO_IDS.every((scenarioId) => receivedScenarioIdSet.has(scenarioId));
  if (!hasExactScenarioIds) {
    throw new Error(
      `SimulationReport.scenarios: expected exactly these scenarioId values: ${SCENARIO_IDS.join(", ")}`,
    );
  }

  for (let scenarioIndex = 0; scenarioIndex < report.scenarios.length; scenarioIndex += 1) {
    const scenario = report.scenarios[scenarioIndex];
    if (scenario.userInput.trim().length === 0) {
      throw new Error(
        `SimulationReport.scenarios[${scenarioIndex}].userInput: expected a non-empty generated user input`,
      );
    }
    if (scenario.characterResponse.trim().length === 0) {
      throw new Error(
        `SimulationReport.scenarios[${scenarioIndex}].characterResponse: expected a non-empty generated character response`,
      );
    }
    for (
      let fieldIndex = 0;
      fieldIndex < scenario.suggestedFields.length;
      fieldIndex += 1
    ) {
      const fieldPath = scenario.suggestedFields[fieldIndex];
      try {
        getValueAtPath(character, fieldPath);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `SimulationReport.scenarios[${scenarioIndex}].suggestedFields[${fieldIndex}]: expected an existing CharacterDraft field path; ${reason}`,
        );
      }
    }
  }

  return report;
}
