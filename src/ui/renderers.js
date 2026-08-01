import { escapeHtml } from "./dom.js";
import {
  renderBriefScreen,
  renderProgressScreen,
  renderQuestionScreen,
} from "./screens/brief-screen.js";
import {
  renderCharacterEditor,
  renderCharacterSummary,
  renderConceptScreen,
  renderStorySummary,
} from "./screens/character-screen.js";
import { renderQuickCheck } from "./screens/evaluation-screen.js";
import { renderPlatformOutput } from "./screens/output-screen.js";
import {
  renderProjectScreen,
  renderSavePanel,
} from "./screens/project-screen.js";
import {
  renderAutosavePill,
  renderFeedback,
} from "./rendering.js";

function renderHeader(state, model) {
  return `
    <header class="app-header">
      <button type="button" class="brand-button" data-action="go-home" aria-label="返回首页">
        <span class="brand-mark" aria-hidden="true">策</span>
        <span><small>女性向创作工作台</small><strong>角色策划与猫箱输入包生成器</strong></span>
      </button>
      <div class="header-meta" aria-label="当前运行信息">
        <label class="mode-control" for="app-mode">
          <span>运行方式</span>
          <select id="app-mode" data-app-mode>
            <option value="mock"${state.mode !== "real" ? " selected" : ""}>Mock 演示</option>
            <option value="real"${state.mode === "real" ? " selected" : ""}>真实 API</option>
          </select>
        </label>
        <span class="model-name">${escapeHtml(model)}</span>
      </div>
    </header>`;
}

function renderResultScreen(state) {
  const kindLabel = state.projectKind === "story" ? "开放故事" : "角色";
  return `
    <section class="step-panel result-screen" aria-labelledby="result-title">
      <header class="result-header">
        <div>
          <p class="section-kicker">${escapeHtml(kindLabel)}已生成</p>
          <h2 id="result-title">${escapeHtml(state.project.title || "未命名项目")}</h2>
          <p>先看摘要与检查，再复制平台文本；高级编辑默认折叠。</p>
        </div>
        <div class="result-status">${renderAutosavePill(state)}<button type="button" class="button-secondary button-small" data-action="go-home">返回首页</button></div>
      </header>
      <nav class="result-nav" aria-label="结果页分区">
        <a href="#result-summary">摘要</a>
        <a href="#quick-check">快速检查</a>
        <a href="#platform-output">平台文本</a>
        ${state.project.character ? '<a href="#advanced-editor">高级编辑</a>' : ""}
        <a href="#save-export">保存与导出</a>
      </nav>
      ${renderFeedback(state)}
      ${state.project.storyDraft && !state.project.character
        ? renderStorySummary(state)
        : renderCharacterSummary(state)}
      ${renderQuickCheck(state)}
      ${renderPlatformOutput(state)}
      ${renderCharacterEditor(state)}
      ${renderSavePanel(state)}
    </section>`;
}

function renderCurrentView(state) {
  const view = state.currentStep;
  if (view === "create") return renderBriefScreen(state);
  if (view === "questions") return renderQuestionScreen(state);
  if (view === "progress") return renderProgressScreen(state);
  if (view === "concepts") return renderConceptScreen(state);
  if (view === "result") return renderResultScreen(state);
  return renderProjectScreen(state);
}

export function renderApp(state, { model }) {
  const normalizedState = {
    ...state,
    projectKind: state.projectKind || (state.project?.storyDraft ? "story" : "character"),
    quickInput: state.quickInput || { idea: "", mustInclude: "", avoid: "" },
    answers: state.answers || {},
    progress: state.progress || [],
    autosaveStatus: state.autosaveStatus || (state.dirty ? "pending" : "idle"),
    revisionHistory: state.revisionHistory || [],
    fieldInstructions: state.fieldInstructions || {},
  };
  return `
    <div class="app-shell"${state.loading ? ' aria-busy="true"' : ""}>
      ${renderHeader(normalizedState, model)}
      <main class="main-content">${renderCurrentView(normalizedState)}</main>
      <footer>项目保存在当前浏览器；真实模式的密钥只由本地代理处理。</footer>
    </div>`;
}
