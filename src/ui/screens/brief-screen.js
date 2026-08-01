import { escapeHtml } from "../dom.js";
import { disabled, renderFeedback } from "../rendering.js";

function renderTextField({
  name,
  label,
  value,
  rows = 0,
  help = "",
  placeholder = "",
}) {
  const id = `create-${name}`;
  const control = rows
    ? `<textarea id="${id}" name="${name}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input id="${id}" name="${name}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`;
  return `
    <label class="form-field" for="${id}">
      <span>${escapeHtml(label)}</span>
      ${control}
      ${help ? `<small>${escapeHtml(help)}</small>` : ""}
    </label>`;
}

function renderAdvancedBrief(state) {
  const brief = state.advancedBrief || {};
  return `
    <details class="advanced-brief">
      <summary>高级表单 <span>可选，默认不需要填写</span></summary>
      <div class="advanced-brief-body">
        <p class="helper-text">已填写内容会作为创作约束；完整填写时，“探索 3 个方向”会直接使用这份简报。</p>
        <div class="form-grid">
          ${renderTextField({ name: "advanced-characterGender", label: "角色性别", value: brief.characterGender || "" })}
          ${renderTextField({ name: "advanced-ageRange", label: "年龄范围", value: brief.ageRange || "" })}
        </div>
        ${renderTextField({ name: "advanced-worldSetting", label: "世界设定", value: brief.worldSetting || "", rows: 3 })}
        ${renderTextField({ name: "advanced-characterIdentity", label: "角色身份", value: brief.characterIdentity || "", rows: 2 })}
        ${renderTextField({ name: "advanced-coreExperiences", label: "核心经历", value: (brief.coreExperiences || []).join("\n"), rows: 3, help: "每行一项" })}
        ${renderTextField({ name: "advanced-relationshipType", label: "关系类型", value: brief.relationshipType || "", rows: 2 })}
        ${renderTextField({ name: "advanced-coreConflict", label: "核心冲突", value: brief.coreConflict || "", rows: 3 })}
        ${renderTextField({ name: "advanced-personalityContradiction", label: "性格矛盾", value: brief.personalityContradiction || "", rows: 3 })}
        <label class="form-field" for="create-advanced-initiativeLevel">
          <span>主动程度</span>
          <select id="create-advanced-initiativeLevel" name="advanced-initiativeLevel">
            <option value="low"${brief.initiativeLevel === "low" ? " selected" : ""}>低</option>
            <option value="medium"${!brief.initiativeLevel || brief.initiativeLevel === "medium" ? " selected" : ""}>中</option>
            <option value="high"${brief.initiativeLevel === "high" ? " selected" : ""}>高</option>
          </select>
        </label>
        ${renderTextField({ name: "advanced-interactionTone", label: "互动基调", value: (brief.interactionTone || []).join("\n"), rows: 3, help: "每行一项" })}
        ${renderTextField({ name: "advanced-boundaries", label: "边界", value: (brief.boundaries || []).join("\n"), rows: 3, help: "每行一项" })}
        ${renderTextField({ name: "advanced-bannedBehaviors", label: "禁用行为", value: (brief.bannedBehaviors || []).join("\n"), rows: 3, help: "每行一项" })}
        ${renderTextField({ name: "advanced-extraNotes", label: "补充说明", value: brief.extraNotes || "", rows: 3 })}
        <input type="hidden" name="advanced-outputMode" value="${escapeHtml(brief.outputMode || "free_character")}" />
      </div>
    </details>`;
}

export function renderBriefScreen(state) {
  const kindLabel = state.projectKind === "story" ? "开放故事" : "角色";
  return `
    <section class="step-panel create-screen" aria-labelledby="create-title">
      <div class="step-heading">
        <p>${escapeHtml(kindLabel)} · 快速输入</p>
        <h2 id="create-title">先说最重要的那一句</h2>
        <span>可选约束只用来守住方向，不会把你拖进一张长表单。</span>
      </div>
      ${renderFeedback(state)}
      <form class="quick-form" data-form="quick-input">
        <section class="card quick-input-card">
          ${renderTextField({
            name: "idea",
            label: "一句话灵感",
            value: state.quickInput?.idea || "",
            rows: 4,
            placeholder: state.projectKind === "story"
              ? "例如：暴雨封城的最后一夜，我和旧日盟友必须决定是否公开一份会伤害双方的证据。"
              : "例如：克制守序的档案官，与我签下限期契约共同追查旧案。",
          })}
          <div class="form-grid constraint-grid">
            ${renderTextField({ name: "mustInclude", label: "必须出现（可选）", value: state.quickInput?.mustInclude || "", rows: 4, help: "每行一项" })}
            ${renderTextField({ name: "avoid", label: "不要出现（可选）", value: state.quickInput?.avoid || "", rows: 4, help: "每行一项" })}
          </div>
          ${state.projectKind === "character" ? renderAdvancedBrief(state) : ""}
          <div class="quick-actions">
            <button type="submit" class="button-primary" data-generation-mode="direct"${disabled(state)}>直接生成</button>
            ${state.projectKind === "character"
              ? `<button type="submit" class="button-secondary" data-generation-mode="explore"${disabled(state)}>探索 3 个方向</button>`
              : ""}
          </div>
        </section>
      </form>
      <button type="button" class="text-button back-home" data-action="go-home"${disabled(state)}>返回首页</button>
    </section>`;
}

function getQuestionPrompt(question, projectKind) {
  const prompt = String(question.prompt || "");
  return projectKind === "story"
    ? prompt.replace("推动这名角色主动行动", "持续推动故事")
    : prompt;
}

function renderQuestion(question, answer, projectKind) {
  return `
    <fieldset class="card question-card">
      <legend>${escapeHtml(getQuestionPrompt(question, projectKind))}</legend>
      <div class="question-options">
        ${question.options.map((option) => `
          <label class="choice-card">
            <input type="radio" name="question-${escapeHtml(question.id)}" value="${escapeHtml(option)}"${answer === option ? " checked" : ""} />
            <span><strong>${escapeHtml(option)}</strong>${option === question.recommended ? '<small class="recommended-label">推荐</small>' : ""}</span>
          </label>`).join("")}
      </div>
      <label class="form-field short-answer" for="question-text-${escapeHtml(question.id)}">
        <span>或写一个简短回答</span>
        <input id="question-text-${escapeHtml(question.id)}" name="question-text-${escapeHtml(question.id)}" type="text" value="${answer && !question.options.includes(answer) ? escapeHtml(answer) : ""}" />
      </label>
    </fieldset>`;
}

export function renderQuestionScreen(state) {
  const questions = (state.questions || []).slice(0, 3);
  return `
    <section class="step-panel question-screen" aria-labelledby="question-title">
      <div class="step-heading">
        <p>可选追问 · 最多 ${questions.length} 题</p>
        <h2 id="question-title">只确认会改变方向的事</h2>
        <span>所有题都可以跳过；未回答时会采用保守推断。</span>
      </div>
      ${renderFeedback(state)}
      <form data-form="questions" class="question-form">
        ${questions.map((question) => renderQuestion(
          question,
          state.answers?.[question.id] || "",
          state.projectKind,
        )).join("")}
        <div class="question-actions">
          <button type="submit" class="button-primary" data-answer-mode="recommended"${disabled(state)}>采用推荐并继续</button>
          <button type="submit" class="button-secondary" data-answer-mode="current"${disabled(state)}>用当前答案继续</button>
          <button type="submit" class="text-button" data-answer-mode="skip"${disabled(state)}>跳过问题</button>
        </div>
      </form>
    </section>`;
}

const PROGRESS_STATUS_LABELS = {
  pending: "等待",
  active: "进行中",
  complete: "完成",
  failed: "失败",
  cancelled: "已取消",
};

export function renderProgressScreen(state) {
  const finished = ["complete", "failed", "cancelled"].includes(state.progressStatus);
  return `
    <section class="step-panel progress-screen" aria-labelledby="progress-title">
      <div class="step-heading">
        <p>真实生成进度</p>
        <h2 id="progress-title">正在把灵感整理成可用项目</h2>
        <span>这里只显示实际调用的四个阶段。</span>
      </div>
      ${renderFeedback(state)}
      <section class="card progress-card" aria-live="polite">
        <ol class="progress-list">
          ${(state.progress || []).map((stage) => `
            <li class="progress-item is-${escapeHtml(stage.status)}" data-progress-stage="${escapeHtml(stage.id)}" data-progress-status="${escapeHtml(stage.status)}">
              <span class="progress-marker" aria-hidden="true"></span>
              <span><strong>${escapeHtml(stage.label)}</strong><small>${escapeHtml(PROGRESS_STATUS_LABELS[stage.status] || stage.status)}</small></span>
            </li>`).join("")}
        </ol>
        ${state.progressStatus === "cancelled" ? '<p class="message-inline">任务已取消；已完成的项目内容不会被后续请求覆盖。</p>' : ""}
        ${state.progressStatus === "failed" ? '<p class="message-inline error-text">当前阶段失败，可返回修改输入后重试。</p>' : ""}
        <div class="progress-actions">
          ${state.loading && state.pendingAction === "generation"
            ? '<button type="button" class="button-danger" data-action="cancel-generation">取消任务</button>'
            : ""}
          ${finished && state.progressStatus !== "complete"
            ? '<button type="button" class="button-secondary" data-action="back-to-create">返回快速输入</button>'
            : ""}
        </div>
      </section>
    </section>`;
}
