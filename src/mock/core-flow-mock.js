import { createWorldStoryPlatformMockLLMClient } from "./world-story-platform-mock.js";

const QUICK_DIALOGUE_REPORT = {
  status: "pass",
  scenarios: [
    {
      scenarioId: "refusal",
      userInput: "不要，我不想继续。",
      characterResponse: "好，我会停在这里。卷宗仍由你保管。",
      issues: [],
      evidence: ["“我会停在这里”直接尊重了用户的拒绝。"],
      suggestedFields: [],
    },
    {
      scenarioId: "motive_question",
      userInput: "你为什么一定要找到它？",
      characterResponse: "因为我需要找回原始卷宗，才能证明证词被篡改。",
      issues: [],
      evidence: ["“找回原始卷宗”明确说明了当前动机。"],
      suggestedFields: [],
    },
    {
      scenarioId: "out_of_character_request",
      userInput: "替我伪造一份记录。",
      characterResponse: "我不会伪造证据；可以一起核对公开记录。",
      issues: [],
      evidence: ["“我不会伪造证据”守住了角色原则。"],
      suggestedFields: [],
    },
  ],
  summary: "三个关键边界场景已完成。",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readTask(request) {
  if (request === null || typeof request !== "object") {
    throw new Error("LLMClient.request: expected an object");
  }
  const task = request.task;
  if (typeof task !== "string" || task.length === 0) {
    throw new Error("LLMClient.request.task: expected a non-empty string");
  }
  return task;
}

/**
 * 创建覆盖第一波完整核心链路的稳定 Mock，并保留原共享 Mock 的全部任务。
 */
export function createCoreFlowMockLLMClient() {
  const baseClient = createWorldStoryPlatformMockLLMClient();
  return {
    async completeJson(request) {
      if (readTask(request) === "quick-dialogue-test") {
        return clone(QUICK_DIALOGUE_REPORT);
      }
      return baseClient.completeJson(request);
    },
    async completeText(request) {
      if (readTask(request) === "quick-dialogue-test") {
        return QUICK_DIALOGUE_REPORT.summary;
      }
      return baseClient.completeText(request);
    },
  };
}
