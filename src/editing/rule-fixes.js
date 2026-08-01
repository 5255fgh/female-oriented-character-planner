import {
  assertProjectDocument,
  getValueAtPath,
} from "../contracts.js";
import { proposeFieldRevision } from "./field-revision.js";

/**
 * 为共享契约中没有 id 字段的规则问题生成本次报告内稳定的选择标识。
 *
 * @param {import("../contracts.js").RuleCheckIssue} issue
 * @param {number} index
 * @returns {string}
 */
export function getRuleIssueId(issue, index) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("index: expected a non-negative integer");
  }
  return `issue-${index}:${issue.code}:${issue.fieldPath}`;
}

/**
 * 解析用户明确选择的问题；所有选择先完成校验，避免产生部分提案。
 *
 * @param {import("../contracts.js").RuleCheckIssue[]} issues
 * @param {string[]} selectedIssueIds
 * @returns {Array<{id: string, issue: import("../contracts.js").RuleCheckIssue}>}
 */
function resolveSelectedIssues(issues, selectedIssueIds) {
  if (!Array.isArray(selectedIssueIds)) {
    throw new Error("selectedIssueIds: expected an array");
  }
  const selections = selectedIssueIds.map((id, index) => {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`selectedIssueIds[${index}]: expected a non-empty string`);
    }
    return id;
  });
  if (new Set(selections).size !== selections.length) {
    throw new Error("selectedIssueIds: duplicate selections are not allowed");
  }

  const indexedIssues = issues.map((issue, index) => ({
    id: getRuleIssueId(issue, index),
    issue,
    aliases: [issue.code, `${issue.code}:${issue.fieldPath}`],
  }));
  const resolved = [];
  const resolvedIds = new Set();
  for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex += 1) {
    const selection = selections[selectionIndex];
    const matches = indexedIssues.filter(
      (candidate) =>
        candidate.id === selection || candidate.aliases.includes(selection),
    );
    if (matches.length === 0) {
      throw new Error(`selectedIssueIds[${selectionIndex}]: unknown issue id ${selection}`);
    }
    if (matches.length > 1) {
      throw new Error(
        `selectedIssueIds[${selectionIndex}]: ambiguous issue id; use the issue-N identifier`,
      );
    }
    if (resolvedIds.has(matches[0].id)) {
      throw new Error(`selectedIssueIds[${selectionIndex}]: issue selected more than once`);
    }
    resolvedIds.add(matches[0].id);
    resolved.push(matches[0]);
  }
  return resolved;
}

/**
 * 对用户明确选择的问题只生成一轮独立提案；不应用、不复检、不循环改写。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {string[]} selectedIssueIds
 * @param {{completeJson(request: object): Promise<object>}} llmClient
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<import("./revision-core.js").FieldRevision[]>}
 */
export async function proposeRuleFixes(
  project,
  selectedIssueIds,
  llmClient,
  options,
) {
  assertProjectDocument(project);
  if (project.character === null) {
    throw new Error("project.character: expected a generated character");
  }
  if (project.ruleReport === null) {
    throw new Error("project.ruleReport: expected a rule report");
  }
  const selectedIssues = resolveSelectedIssues(
    project.ruleReport.issues,
    selectedIssueIds,
  );

  for (let index = 0; index < selectedIssues.length; index += 1) {
    const { issue } = selectedIssues[index];
    try {
      getValueAtPath(project.character, issue.fieldPath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `selectedIssueIds[${index}]: issue does not point to an editable character field; ${reason}`,
      );
    }
  }

  const proposals = [];
  for (const { id, issue } of selectedIssues) {
    proposals.push(
      await proposeFieldRevision(
        project,
        issue.fieldPath,
        issue.suggestedAction,
        {
          source: "rule-check",
          issueId: id,
          issueCode: issue.code,
          message: issue.message,
          evidence: issue.evidence,
        },
        llmClient,
        options,
      ),
    );
  }
  return proposals;
}
