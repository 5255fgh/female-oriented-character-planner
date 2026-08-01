import { escapeHtml } from "../dom.js";
import {
  disabled,
  isPending,
  renderFeedback,
  SCENARIO_LABELS,
  STATUS_LABELS,
} from "../rendering.js";

function renderRuleReport(state) {
  const report = state.project.ruleReport;
  if (!report) return '<p class="empty-state">尚未运行规则检查。</p>';
  return `
    <div class="report-header"><span class="status-pill status-${report.status}">${STATUS_LABELS[report.status] || report.status}</span><span>${report.issues.length} 个问题</span></div>
    ${report.issues.length === 0 ? '<p class="empty-state success-text">没有发现固定规则问题。</p>' : `
      <ol class="issue-list">
        ${report.issues.map((issue) => `
          <li class="issue-card severity-${issue.severity}">
            <div class="issue-heading"><span class="status-pill status-${issue.severity}">${issue.severity === "error" ? "错误" : "提醒"}</span><button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(issue.fieldPath)}">${escapeHtml(issue.fieldPath)}</button></div>
            <strong>${escapeHtml(issue.message)}</strong>
            <dl><div><dt>证据</dt><dd>${escapeHtml(issue.evidence)}</dd></div><div><dt>建议</dt><dd>${escapeHtml(issue.suggestedAction)}</dd></div></dl>
          </li>`).join("")}
      </ol>`}`;
}

function renderStringList(items, emptyText = "无") {
  if (!items.length) return `<span class="muted">${emptyText}</span>`;
  return `<ul class="plain-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSimulationReport(state) {
  const report = state.project.simulationReport;
  if (!report) return '<p class="empty-state">尚未运行 8 场景模拟。</p>';
  return `
    <div class="report-header"><span class="status-pill status-${report.status}">${STATUS_LABELS[report.status] || report.status}</span><span>正好 ${report.scenarios.length} 个场景</span></div>
    <p class="report-summary">${escapeHtml(report.summary)}</p>
    <div class="scenario-list">
      ${report.scenarios.map((scenario, index) => `
        <article class="scenario-card">
          <p class="card-index">场景 ${index + 1}</p>
          <h4>${escapeHtml(SCENARIO_LABELS[scenario.scenarioId] || scenario.scenarioId)}</h4>
          <code>${escapeHtml(scenario.scenarioId)}</code>
          <dl class="scenario-content">
            <div><dt>用户输入</dt><dd>${escapeHtml(scenario.userInput)}</dd></div>
            <div><dt>角色回应</dt><dd>${escapeHtml(scenario.characterResponse)}</dd></div>
            <div><dt>问题</dt><dd>${renderStringList(scenario.issues)}</dd></div>
            <div><dt>证据</dt><dd>${renderStringList(scenario.evidence)}</dd></div>
            <div><dt>建议字段</dt><dd>${scenario.suggestedFields.length ? `<div class="field-links">${scenario.suggestedFields.map((path) => `<button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(path)}">${escapeHtml(path)}</button>`).join("")}</div>` : '<span class="muted">无</span>'}</dd></div>
          </dl>
        </article>`).join("")}
    </div>`;
}

export function renderEvaluationScreen(state) {
  const reportsReady = state.project.ruleReport && state.project.simulationReport;
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 4 / 6</p><h2 id="step-title">质量检查</h2>
        <span>固定规则与八场景模拟彼此独立，只报告问题，不自动循环重写。</span>
      </div>
      ${renderFeedback(state)}
      <section class="card report-section">
        <div class="section-heading"><div><p class="section-kicker">A</p><h3>规则检查</h3></div><button type="button" class="button-primary" data-action="run-rules"${disabled(state)}>${isPending(state, "run-rules") ? "检查中…" : "运行规则检查"}</button></div>
        ${renderRuleReport(state)}
      </section>
      <section class="card report-section">
        <div class="section-heading"><div><p class="section-kicker">B</p><h3>8 场景模拟</h3></div><button type="button" class="button-primary" data-action="run-simulation"${disabled(state)}>${isPending(state, "run-simulation") ? "模拟中…" : "运行 8 场景模拟"}</button></div>
        ${renderSimulationReport(state)}
      </section>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="3"${disabled(state)}>返回角色编辑器</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="5"${disabled(state, !reportsReady)}>生成猫箱输入包</button>
      </div>
    </section>`;
}
