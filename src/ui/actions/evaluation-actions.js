import { runDialogueTest } from "../../evaluation/dialogue-tester.js";
import { checkRules } from "../../evaluation/rule-checker.js";

function markChanged(state) {
  state.dirty = true;
  state.notice = "";
}

export function runRulesForProject(state) {
  state.project.ruleReport = checkRules(state.project.character);
  markChanged(state);
  state.notice = "规则检查已完成。";
}

export async function runSimulationForProject(state, llmClient) {
  state.project.simulationReport = await runDialogueTest(
    state.project.character,
    llmClient,
  );
  markChanged(state);
  state.notice = "8 场景模拟已完成。";
}
