import { escapeHtml } from "../dom.js";
import {
  disabled,
  isPending,
  SCENARIO_LABELS,
  STATUS_LABELS,
} from "../rendering.js";
import { isCharacterArtifactStale } from "../platform-copy.js";

function renderRuleIssue(state, issue, index) {
  const isError = issue.severity === "error";
  return `
    <li class="issue-card severity-${escapeHtml(issue.severity)}" data-issue-severity="${escapeHtml(issue.severity)}">
      <div class="issue-heading">
        <span class="status-pill ${isError ? "status-fail" : "status-warning"}">${isError ? "错误" : "提醒"}</span>
        <code>${escapeHtml(issue.code || `issue-${index}`)}</code>
      </div>
      <strong>${escapeHtml(issue.message)}</strong>
      <div class="issue-actions">
        <details class="evidence-details">
          <summary>查看证据</summary>
          <dl><div><dt>证据</dt><dd>${escapeHtml(issue.evidence)}</dd></div><div><dt>建议</dt><dd>${escapeHtml(issue.suggestedAction)}</dd></div></dl>
        </details>
        ${issue.fieldPath ? `<button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(issue.fieldPath)}"${disabled(state)}>跳转字段：${escapeHtml(issue.fieldPath)}</button>` : ""}
      </div>
    </li>`;
}

function renderQuickScenario(state, scenario, index) {
  const hasIssues = scenario.issues.length > 0;
  return `
    <article class="scenario-card${hasIssues ? " severity-warning" : ""}">
      <div class="issue-heading">
        <span class="status-pill ${hasIssues ? "status-warning" : "status-pass"}">${hasIssues ? "提醒" : "通过"}</span>
        <strong>${escapeHtml(SCENARIO_LABELS[scenario.scenarioId] || `场景 ${index + 1}`)}</strong>
      </div>
      <p>${escapeHtml(scenario.characterResponse)}</p>
      <details class="evidence-details">
        <summary>查看证据</summary>
        <dl class="scenario-content">
          <div><dt>用户输入</dt><dd>${escapeHtml(scenario.userInput)}</dd></div>
          <div><dt>问题</dt><dd>${scenario.issues.length ? scenario.issues.map((item) => `<p>${escapeHtml(item)}</p>`).join("") : "无"}</dd></div>
          <div><dt>证据</dt><dd>${scenario.evidence.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</dd></div>
        </dl>
      </details>
      ${scenario.suggestedFields.length ? `<div class="field-links">${scenario.suggestedFields.map((path) => `<button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(path)}"${disabled(state)}>跳转字段：${escapeHtml(path)}</button>`).join("")}</div>` : ""}
    </article>`;
}

function renderFullSimulation(state) {
  const report = state.project.simulationReport;
  if (!report) return "";
  const stale = isCharacterArtifactStale(state.project, "full-simulation");
  return `
    <details class="full-simulation">
      <summary>查看完整 8 场景结果 <span class="status-pill status-${escapeHtml(report.status)}">${escapeHtml(STATUS_LABELS[report.status] || report.status)}</span>${stale ? ' <span class="status-pill status-neutral">可能已过期</span>' : ""}</summary>
      ${stale ? '<p class="message-inline">该结果基于修改前的角色，已保留供对照。</p>' : ""}
      <p>${escapeHtml(report.summary)}</p>
      <ol class="scenario-list full-scenario-list">
        ${report.scenarios.map((scenario, index) => `
          <li class="scenario-card">
            <strong>${index + 1}. ${escapeHtml(SCENARIO_LABELS[scenario.scenarioId] || scenario.scenarioId)}</strong>
            <p><b>用户：</b>${escapeHtml(scenario.userInput)}</p>
            <p><b>角色：</b>${escapeHtml(scenario.characterResponse)}</p>
          </li>`).join("")}
      </ol>
    </details>`;
}

function renderCharacterCheck(state) {
  const ruleReport = state.project.ruleReport;
  const quickReport = state.quickDialogueReport;
  const stale = Boolean(
    (ruleReport || quickReport) &&
    isCharacterArtifactStale(state.project, "quick-check"),
  );
  const issues = ruleReport?.issues || [];
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const status = errors.length > 0
    ? "fail"
    : warnings.length > 0 || quickReport?.status === "warning"
      ? "warning"
      : ruleReport && quickReport
        ? "pass"
        : "pending";

  return `
    <section class="card check-section" id="quick-check" aria-labelledby="check-title">
      <div class="section-heading">
        <div><p class="section-kicker">快速检查</p><h3 id="check-title">错误与提醒分开处理</h3></div>
        <span class="status-pill ${stale ? "status-neutral" : status === "fail" ? "status-fail" : status === "warning" ? "status-warning" : status === "pass" ? "status-pass" : "status-neutral"}">${stale ? "可能已过期" : status === "pending" ? "尚未运行" : STATUS_LABELS[status]}</span>
      </div>
      <p class="helper-text">提醒不会阻止复制；无效的平台字段会在平台输出区单独阻止复制。</p>
      ${stale ? '<p class="message-inline">旧检查结果已保留供对照，可按需重新运行。</p>' : ""}
      ${!ruleReport
        ? '<p class="empty-state">尚未运行快速检查。</p>'
        : issues.length === 0
          ? '<p class="empty-state success-text">固定规则没有发现错误或提醒。</p>'
          : `<div class="check-counts"><span class="status-pill status-fail">错误 ${errors.length}</span><span class="status-pill status-warning">提醒 ${warnings.length}</span></div><ol class="issue-list">${issues.map((issue, index) => renderRuleIssue(state, issue, index)).join("")}</ol>`}
      ${quickReport
        ? `<div class="quick-dialogue"><h4>3 场景快速测试</h4><p>${escapeHtml(quickReport.summary)}</p><div class="scenario-list">${quickReport.scenarios.map((scenario, index) => renderQuickScenario(state, scenario, index)).join("")}</div></div>`
        : ""}
      <div class="check-actions">
        <button type="button" class="button-secondary" data-action="run-quick-check"${disabled(state)}>${isPending(state, "quick-check") ? "检查中…" : "运行 3 场景快速检查"}</button>
        <button type="button" class="button-secondary" data-action="run-full-simulation"${disabled(state)}>${isPending(state, "full-simulation") ? "测试中…" : "运行完整 8 场景高级测试"}</button>
      </div>
      ${renderFullSimulation(state)}
    </section>`;
}

function renderStoryCheck(state) {
  const check = state.storyCheck;
  return `
    <section class="card check-section" id="quick-check" aria-labelledby="story-check-title">
      <div class="section-heading">
        <div><p class="section-kicker">快速检查</p><h3 id="story-check-title">故事结构</h3></div>
        <span class="status-pill ${check?.status === "pass" ? "status-pass" : "status-neutral"}">${check?.status === "pass" ? "通过" : "需要更新"}</span>
      </div>
      <p>${escapeHtml(check?.message || "故事结构需要重新校验并生成平台文本。")}</p>
      <button type="button" class="button-secondary" data-action="run-quick-check"${disabled(state)}>运行故事结构检查</button>
    </section>`;
}

export function renderQuickCheck(state) {
  return state.project.storyDraft && !state.project.character
    ? renderStoryCheck(state)
    : renderCharacterCheck(state);
}
