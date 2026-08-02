export { proposeFieldRevision } from "./field-revision.js";
export {
  appendRevisionHistory,
  applyConfirmedRevision,
  createRevisionDiff,
  MAX_REVISION_HISTORY,
  undoRevision,
} from "./revision-core.js";
export {
  getRuleIssueId,
  proposeRuleFixes,
} from "./rule-fixes.js";
