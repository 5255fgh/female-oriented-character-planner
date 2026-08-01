import { escapeHtml, formatDateTime } from "./dom.js";

export const OUTPUT_MODE_LABELS = {
  editor_character: "角色编辑器",
  free_character: "猫箱自由创建",
  dead_rival: "亡者劲敌",
  image_shape: "捏形象",
  editor_open_story: "开放故事编辑器",
};

export const STATUS_LABELS = {
  pass: "通过",
  warning: "提醒",
  fail: "错误",
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

export const AUTOSAVE_LABELS = {
  idle: "尚未保存",
  pending: "等待保存",
  saving: "保存中",
  saved: "已保存",
  error: "保存失败",
  cancelled: "保存已取消",
};

export function isPending(state, action) {
  return state.loading && state.pendingAction === action;
}

export function disabled(state, condition = false) {
  return state.loading || condition ? " disabled" : "";
}

export function autosaveStatusClass(status) {
  if (status === "saved") return "status-pass";
  if (status === "error") return "status-fail";
  if (status === "saving" || status === "pending") return "status-warning";
  return "status-neutral";
}

export function renderFeedback(state) {
  const showGenericLoading = state.loading && state.currentStep !== "progress";
  const canCancelRequest = showGenericLoading && (
    state.pendingAction === "full-simulation" ||
    state.pendingAction === "quick-check" ||
    state.pendingAction === "generate-platform-pack" ||
    String(state.pendingAction || "").startsWith("revision-")
  );
  return `
    ${state.error ? `<div class="message message-error" role="alert"><strong>操作未完成</strong><p>${escapeHtml(state.error)}</p></div>` : ""}
    ${state.notice ? `<div class="message message-success" role="status">${escapeHtml(state.notice)}</div>` : ""}
    ${showGenericLoading ? `<div class="loading-bar" role="status" aria-live="polite"><span>正在处理当前操作…</span>${canCancelRequest ? '<button type="button" class="button-danger button-small" data-action="cancel-current-request">取消当前请求</button>' : ""}</div>` : ""}`;
}

export function renderAutosavePill(state) {
  const status = state.autosaveStatus || (state.dirty ? "pending" : "idle");
  return `<span class="status-pill ${autosaveStatusClass(status)}" data-save-status data-status="${escapeHtml(status)}">${escapeHtml(AUTOSAVE_LABELS[status] || status)}</span>`;
}

export function renderSavedProjects(state) {
  const projects = Array.isArray(state.savedProjects) ? state.savedProjects : [];
  return `
    <section class="card saved-projects" id="project-library">
      <div class="section-heading">
        <div>
          <p class="section-kicker">本地草稿</p>
          <h3>打开已有项目</h3>
        </div>
        <span class="count-badge">${projects.length} 个</span>
      </div>
      ${projects.length === 0
        ? '<p class="empty-state">还没有本地项目。创建后会自动保存在当前浏览器。</p>'
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
