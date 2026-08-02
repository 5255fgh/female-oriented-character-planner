import { escapeHtml, formatDateTime } from "../dom.js";
import {
  disabled,
  isPending,
  renderAutosavePill,
  renderFeedback,
  renderSavedProjects,
} from "../rendering.js";

function renderRecoveryPrompt(state) {
  const recovery = state.savedProjects?.find(
    (project) => project.id === state.recoveryProjectId,
  );
  if (!recovery || state.recoveryDismissed) return "";
  return `
    <aside class="recovery-banner" role="status" aria-label="恢复草稿提示">
      <div>
        <strong>发现上次草稿</strong>
        <p>“${escapeHtml(recovery.title || "未命名项目")}”更新于 ${escapeHtml(formatDateTime(recovery.updatedAt))}。</p>
      </div>
      <div class="inline-actions">
        <button type="button" class="button-primary button-small" data-action="recover-project" data-project-id="${escapeHtml(recovery.id)}"${disabled(state)}>恢复草稿</button>
        <button type="button" class="button-secondary button-small" data-action="dismiss-recovery"${disabled(state)}>暂不恢复</button>
      </div>
    </aside>`;
}

export function renderProjectScreen(state) {
  return `
    <section class="step-panel home-screen" aria-labelledby="home-title">
      ${renderFeedback(state)}
      ${renderRecoveryPrompt(state)}
      <div class="home-hero">
        <p class="eyebrow">从一句话到可复制的平台文本</p>
        <h2 id="home-title">今天想创造谁，或打开怎样的故事？</h2>
        <p>先给出灵感与边界；信息不足时最多追问 3 题，其余交给完整工作流。</p>
      </div>
      <div class="entry-grid" aria-label="主要入口">
        <button type="button" class="entry-card entry-primary" data-action="create-character"${disabled(state)}>
          <span class="entry-icon" aria-hidden="true">人</span>
          <span><strong>创建角色</strong><small>生成角色、快速检查与角色编辑器文本</small></span>
        </button>
        <button type="button" class="entry-card" data-action="create-story"${disabled(state)}>
          <span class="entry-icon" aria-hidden="true">章</span>
          <span><strong>创建开放故事</strong><small>生成共享世界、8 个节点与开放故事文本</small></span>
        </button>
        <button type="button" class="entry-card" data-action="open-library"${disabled(state)}>
          <span class="entry-icon" aria-hidden="true">夹</span>
          <span><strong>打开已有项目</strong><small>继续当前浏览器中自动保存的草稿</small></span>
        </button>
        <button type="button" class="entry-card" data-action="choose-import"${disabled(state)}>
          <span class="entry-icon" aria-hidden="true">入</span>
          <span><strong>导入 JSON</strong><small>校验并迁移此前导出的项目文件</small></span>
        </button>
      </div>
      <input class="visually-hidden" type="file" accept="application/json,.json" data-import-file />
      ${renderSavedProjects(state)}
    </section>`;
}

function renderVersions(state) {
  const versions = Array.isArray(state.versions) ? state.versions : [];
  return `
    <details class="version-panel">
      <summary>历史版本 <span class="count-badge">${versions.length}</span></summary>
      ${versions.length === 0
        ? '<p class="empty-state">首次完整生成或手动保存后会留下版本。</p>'
        : `<ol class="record-list version-list">
            ${versions.map((version, index) => `
              <li>
                <div class="record-summary"><strong>版本 ${versions.length - index}</strong><span>${escapeHtml(formatDateTime(version.createdAt))}</span></div>
                <button type="button" class="button-secondary button-small" data-action="restore-version" data-version-id="${escapeHtml(version.id)}"${disabled(state)}>恢复</button>
              </li>`).join("")}
          </ol>`}
    </details>`;
}

export function renderSavePanel(state) {
  return `
    <section class="card save-panel" id="save-export" aria-labelledby="save-title">
      <div class="section-heading">
        <div><p class="section-kicker">本地保存</p><h3 id="save-title">保存与导出</h3></div>
        ${renderAutosavePill(state)}
      </div>
      ${state.autosaveError ? `<p class="autosave-error" role="alert">${escapeHtml(state.autosaveError)}</p>` : ""}
      <label class="form-field" for="project-title">
        <span>项目标题</span>
        <input id="project-title" type="text" value="${escapeHtml(state.project.title || "")}" data-project-title />
      </label>
      <div class="save-actions">
        <button type="button" class="button-primary" data-action="save-project"${disabled(state)}>${isPending(state, "save-project") ? "保存中…" : "立即保存版本"}</button>
        <button type="button" class="button-secondary" data-action="export-json"${disabled(state)}>导出 JSON</button>
        <button type="button" class="button-secondary" data-action="export-markdown"${disabled(state)}>导出 Markdown</button>
      </div>
      <p class="helper-text">普通修改由存储服务自动防抖保存；“立即保存版本”会额外留下可恢复快照。</p>
      ${renderVersions(state)}
    </section>`;
}
