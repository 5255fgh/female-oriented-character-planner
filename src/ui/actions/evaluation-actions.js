import { assertProjectDocument } from "../../contracts.js";
import { checkRules, runDialogueTest } from "../../evaluation/index.js";

function markChanged(state) {
  state.dirty = true;
  state.notice = "";
}

export function runRulesForProject(state) {
  if (!state.project.character) {
    throw new Error("当前项目没有可检查的角色。");
  }
  state.project = {
    ...state.project,
    ruleReport: checkRules(state.project.character),
    updatedAt: new Date().toISOString(),
  };
  assertProjectDocument(state.project);
  markChanged(state);
  state.notice = "规则检查已更新。";
}

export async function runSimulationForProject(state, llmClient) {
  if (!state.project.character) {
    throw new Error("当前项目没有可测试的角色。");
  }
  const simulationReport = await runDialogueTest(
    state.project.character,
    llmClient,
  );
  state.project = {
    ...state.project,
    simulationReport,
    updatedAt: new Date().toISOString(),
  };
  assertProjectDocument(state.project);
  markChanged(state);
  state.notice = "完整 8 场景测试已完成。";
}
