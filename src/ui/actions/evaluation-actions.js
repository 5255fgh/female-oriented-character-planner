import { assertProjectDocument, createId } from "../../contracts.js";
import { runDialogueTest } from "../../evaluation/index.js";
import { withAbortSignal } from "../../llm/abortable-client.js";

function markChanged(state) {
  state.dirty = true;
  state.notice = "";
}

export async function runSimulationForProject(state, llmClient, signal) {
  if (!state.project.character) {
    throw new Error("当前项目没有可测试的角色。");
  }
  const simulationReport = await runDialogueTest(
    state.project.character,
    withAbortSignal(llmClient, signal),
  );
  if (signal?.aborted) {
    if (typeof signal.throwIfAborted === "function") {
      signal.throwIfAborted();
    }
    const error = new Error("任务已取消");
    error.name = "AbortError";
    throw error;
  }
  const completedAt = new Date().toISOString();
  state.project = {
    ...state.project,
    simulationReport,
    generationRecords: [
      ...state.project.generationRecords,
      {
        id: createId("generation"),
        task: "full-simulation",
        target: "character",
        status: "completed",
        createdAt: completedAt,
      },
    ],
    updatedAt: completedAt,
  };
  assertProjectDocument(state.project);
  markChanged(state);
  state.notice = "完整 8 场景测试已完成。";
}
