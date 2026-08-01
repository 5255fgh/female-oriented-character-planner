import { escapeHtml } from "./dom.js";
import { renderBriefScreen } from "./screens/brief-screen.js";
import {
  renderCharacterScreen,
  renderConceptScreen,
} from "./screens/character-screen.js";
import { renderEvaluationScreen } from "./screens/evaluation-screen.js";
import { renderOutputScreen } from "./screens/output-screen.js";
import {
  renderProjectScreen,
  renderStorageScreen,
} from "./screens/project-screen.js";
import {
  canVisitStep,
  disabled,
  SCENARIO_LABELS,
  STEPS,
} from "./rendering.js";

function renderHeader(state, model) {
  return `
    <header class="app-header">
      <div><p class="eyebrow">女性向角色策划工具</p><h1>角色策划与猫箱输入包生成器</h1></div>
      <div class="header-meta" aria-label="当前运行信息">
        <span class="status-pill status-neutral">${state.mode === "mock" ? "Mock 演示" : "真实 API"}</span>
        <span class="model-name">模型：${escapeHtml(model)}</span>
      </div>
    </header>`;
}

function renderStepper(state) {
  return `
    <nav class="step-nav" aria-label="主流程步骤">
      <ol>
        ${STEPS.map((label, index) => `
          <li>
            <button type="button" class="step-button${state.currentStep === index ? " is-current" : ""}" data-action="go-step" data-step="${index}" ${state.currentStep === index ? 'aria-current="step"' : ""}${disabled(state, !canVisitStep(state, index))}>
              <span>${index}</span>${escapeHtml(label)}
            </button>
          </li>`).join("")}
      </ol>
    </nav>`;
}

function renderCurrentStep(state, model) {
  switch (state.currentStep) {
    case 0: return renderProjectScreen(state, model);
    case 1: return renderBriefScreen(state);
    case 2: return renderConceptScreen(state);
    case 3: return renderCharacterScreen(state);
    case 4: return renderEvaluationScreen(state);
    case 5: return renderOutputScreen(state);
    case 6: return renderStorageScreen(state);
    default: return renderProjectScreen(state, model);
  }
}

export function renderApp(state, { model }) {
  return `
    <div class="app-shell"${state.loading ? ' aria-busy="true"' : ""}>
      ${renderHeader(state, model)}
      ${renderStepper(state)}
      <main class="main-content">${renderCurrentStep(state, model)}</main>
      <footer>内容仅保存在当前浏览器；真实模式的密钥由本地代理处理。</footer>
    </div>`;
}

export { SCENARIO_LABELS };
