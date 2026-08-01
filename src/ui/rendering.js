import { escapeHtml, formatDateTime } from "./dom.js";

export const STEPS = [
  "项目与运行模式",
  "创作简报",
  "三个候选",
  "完整角色",
  "质量检查",
  "猫箱输入包",
  "保存与导出",
];

export const OUTPUT_MODE_LABELS = {
  free_character: "猫箱自由创建",
  dead_rival: "死对头",
  image_shape: "捏形象",
};

export const STATUS_LABELS = {
  pass: "通过",
  warning: "有提醒",
  fail: "未通过",
};

export const SCENARIO_LABELS = {
  refusal: "明确拒绝",
  short_replies: "连续短回复",
  motive_question: "追问动机",
  low_mood: "情绪低落",
  user_approaches: "用户主动靠近",
  important_other: "提及重要他人",
  out_of_character_request: "违背人设请求",
  long_conversation_progress: "长对话推进",
};

export function isPending(state, action) {
  return state.loading && state.pendingAction === action;
}

export function disabled(state, condition = false) {
  return state.loading || condition ? " disabled" : "";
}

export function canVisitStep(state, step) {
  if (step <= 1) return true;
  if (step === 2) return state.project.concepts.length === 3;
  if (step <= 4) return Boolean(state.project.character);
  if (step === 5) {
    return Boolean(state.project.ruleReport && state.project.simulationReport);
  }
  return state.project.platformPacks.length > 0;
}

export function renderFeedback(state) {
  return `
    ${state.error ? `<div class="message message-error" role="alert"><strong>操作未完成</strong><p>${escapeHtml(state.error)}</p></div>` : ""}
    ${state.notice ? `<div class="message message-success" role="status">${escapeHtml(state.notice)}</div>` : ""}
    ${state.loading ? `<div class="loading-bar" role="status" aria-live="polite">正在处理，请稍候…</div>` : ""}`;
}

export function renderSavedProjects(state, compact = false) {
  const projects = state.savedProjects;
  return `
    <section class="card saved-projects${compact ? " compact" : ""}">
      <div class="section-heading">
        <div>
          <p class="section-kicker">IndexedDB 本地保存</p>
          <h3>已保存项目</h3>
        </div>
        <span class="count-badge">${projects.length} 个</span>
      </div>
      ${projects.length === 0
        ? '<p class="empty-state">还没有已保存项目。完成主流程后可在步骤 6 保存。</p>'
        : `<ul class="record-list">
            ${projects.map((project) => `
              <li>
                <div class="record-summary">
                  <strong>${escapeHtml(project.title || "未命名项目")}</strong>
                  <span>更新于 ${escapeHtml(formatDateTime(project.updatedAt))}</span>
                </div>
                <div class="inline-actions">
                  <button type="button" class="button-secondary button-small" data-action="load-project" data-project-id="${escapeHtml(project.id)}"${disabled(state)}>打开</button>
                  <button type="button" class="button-danger button-small" data-action="delete-project" data-project-id="${escapeHtml(project.id)}"${disabled(state)}>删除</button>
                </div>
              </li>`).join("")}
          </ul>`}
    </section>`;
}
