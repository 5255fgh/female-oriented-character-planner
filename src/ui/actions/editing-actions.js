import { assertProjectDocument } from "../../contracts.js";
import {
  appendRevisionHistory,
  applyConfirmedRevision,
  createRevisionDiff,
  proposeFieldRevision,
  undoRevision,
} from "../../editing/index.js";
import { selectContextForField } from "../../generation/index.js";

function clearDownstreamUiState(state) {
  state.quickDialogueReport = null;
  state.storyCheck = null;
  state.selectedRuleIssueIds = [];
}

export async function proposeCharacterRevision(
  state,
  fieldPath,
  instruction,
  llmClient,
  signal,
) {
  const context = selectContextForField(state.project, fieldPath);
  const revision = await proposeFieldRevision(
    state.project,
    fieldPath,
    instruction,
    context,
    llmClient,
    { signal },
  );
  state.pendingRevision = revision;
  state.revisionDiff = createRevisionDiff(revision.before, revision.after);
  state.activeFieldPath = fieldPath;
  state.notice = "修改提案已生成，请先核对 before / after / diff。";
  return revision;
}

export function confirmCharacterRevision(state) {
  if (!state.pendingRevision) {
    throw new Error("当前没有待确认的字段修改。");
  }
  const result = applyConfirmedRevision(state.project, state.pendingRevision);
  state.project = result.project;
  state.revisionHistory = appendRevisionHistory(
    state.revisionHistory,
    result.historyEntry,
  );
  state.activeFieldPath = state.pendingRevision.fieldPath;
  state.pendingRevision = null;
  state.revisionDiff = null;
  clearDownstreamUiState(state);
  state.dirty = true;
  state.notice = "字段修改已应用；快速检查与平台文本需要重新生成。";
  assertProjectDocument(state.project);
  return result.historyEntry;
}

export function discardCharacterRevision(state) {
  state.pendingRevision = null;
  state.revisionDiff = null;
  state.notice = "字段修改提案已放弃，原内容未变化。";
}

export function undoLastCharacterRevision(state) {
  const result = undoRevision(state.project, state.revisionHistory);
  state.project = result.project;
  state.revisionHistory = result.history;
  state.pendingRevision = null;
  state.revisionDiff = null;
  clearDownstreamUiState(state);
  state.dirty = true;
  state.notice = "最近一次已确认修改已撤销。";
  assertProjectDocument(state.project);
}
