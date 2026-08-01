import { escapeHtml, formatDateTime } from "../dom.js";
import {
  disabled,
  isPending,
  renderFeedback,
  renderSavedProjects,
} from "../rendering.js";

export function renderProjectScreen(state, model) {
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 0 / 6</p>
        <h2 id="step-title">项目与运行模式</h2>
        <span>选择运行方式，再创建或打开一个项目。切换模式不会清空当前工作内容。</span>
      </div>
      ${renderFeedback(state)}
      <div class="two-column-layout">
        <section class="card">
          <h3>运行模式</h3>
          <fieldset class="choice-group">
            <legend class="visually-hidden">选择运行模式</legend>
            <label class="choice-card">
              <input type="radio" name="appMode" value="mock" data-app-mode${state.mode === "mock" ? " checked" : ""}${disabled(state)} />
              <span><strong>Mock 演示</strong><small>使用本地稳定示例，不发送网络请求。</small></span>
            </label>
            <label class="choice-card">
              <input type="radio" name="appMode" value="real" data-app-mode${state.mode === "real" ? " checked" : ""}${disabled(state)} />
              <span><strong>真实 API</strong><small>通过本地 Vite 代理调用模型服务。</small></span>
            </label>
          </fieldset>
          <p class="model-card">当前模型 <code>${escapeHtml(model)}</code></p>
          <p class="helper-text">页面不读取、输入或保存 API Key。</p>
        </section>
        <section class="card">
          <h3>新建项目</h3>
          <form data-form="new-project">
            <label class="form-field" for="new-project-title">
              <span>项目标题</span>
              <input id="new-project-title" name="title" type="text" maxlength="80" placeholder="例如：雨夜禁书库角色企划" required${disabled(state)} />
            </label>
            <button type="submit" class="button-primary full-width"${disabled(state)}>开始创作</button>
          </form>
          <p class="helper-text">也可以直接导入此前导出的 JSON 项目。</p>
          <button type="button" class="button-secondary full-width" data-action="choose-import"${disabled(state)}>导入 JSON</button>
          <input class="visually-hidden" type="file" accept="application/json,.json" data-import-file />
        </section>
      </div>
      ${renderSavedProjects(state)}
    </section>`;
}

function renderVersions(state) {
  return `
    <section class="card">
      <div class="section-heading">
        <div><p class="section-kicker">每次保存自动生成</p><h3>历史版本</h3></div>
        <span class="count-badge">${state.versions.length} 个</span>
      </div>
      ${state.versions.length === 0
        ? '<p class="empty-state">保存项目后会在这里留下版本。</p>'
        : `<ol class="record-list version-list">
            ${state.versions.map((version, index) => `
              <li>
                <div class="record-summary"><strong>版本 ${state.versions.length - index}</strong><span>${escapeHtml(formatDateTime(version.createdAt))}</span></div>
                <button type="button" class="button-secondary button-small" data-action="restore-version" data-version-id="${escapeHtml(version.id)}"${disabled(state)}>恢复</button>
              </li>`).join("")}
          </ol>`}
    </section>`;
}

export function renderStorageScreen(state) {
  const isStored = state.savedProjects.some((project) => project.id === state.project.id);
  const exportDisabled = !isStored || state.dirty;
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 6 / 6</p>
        <h2 id="step-title">保存、历史和导出</h2>
        <span>保存写入本机 IndexedDB；未保存的编辑不会自动持久化。</span>
      </div>
      ${renderFeedback(state)}
      <div class="two-column-layout save-layout">
        <section class="card">
          <div class="section-heading">
            <h3>当前项目</h3>
            <span class="status-pill ${state.dirty ? "status-warning" : "status-pass"}" data-save-status>${state.dirty ? "有未保存修改" : "已保存"}</span>
          </div>
          <label class="form-field" for="save-project-title">
            <span>项目标题</span>
            <input id="save-project-title" type="text" value="${escapeHtml(state.project.title)}" data-project-title />
          </label>
          <button type="button" class="button-primary full-width" data-action="save-project"${disabled(state)}>${isPending(state, "save-project") ? "保存中…" : "保存项目"}</button>
          <p class="helper-text">每次保存都会留下一个可恢复版本。</p>
        </section>
        <section class="card">
          <h3>导入与导出</h3>
          <div class="stacked-actions">
            <button type="button" class="button-secondary" data-action="export-json"${disabled(state, exportDisabled)}>导出 JSON</button>
            <button type="button" class="button-secondary" data-action="export-markdown"${disabled(state, exportDisabled)}>导出 Markdown</button>
            <button type="button" class="button-secondary" data-action="choose-import"${disabled(state)}>导入 JSON</button>
            <input class="visually-hidden" type="file" accept="application/json,.json" data-import-file />
          </div>
          <p class="helper-text" data-export-helper>${exportDisabled ? "请先保存当前修改，再导出最新版本。" : "导出内容与当前已保存版本一致。"}</p>
        </section>
      </div>
      ${renderVersions(state)}
      ${renderSavedProjects(state, true)}
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="5"${disabled(state)}>返回输入包</button>
      </div>
    </section>`;
}
