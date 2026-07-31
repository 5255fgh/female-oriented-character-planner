import { getValueAtPath } from "../contracts.js";
import {
  arrayToLines,
  domIdForPath,
  escapeHtml,
  formatDateTime,
} from "./dom.js";

const STEPS = [
  "项目与运行模式",
  "创作简报",
  "三个候选",
  "完整角色",
  "质量检查",
  "猫箱输入包",
  "保存与导出",
];

const OUTPUT_MODE_LABELS = {
  free_character: "猫箱自由创建",
  dead_rival: "死对头",
  image_shape: "捏形象",
};

const STATUS_LABELS = {
  pass: "通过",
  warning: "有提醒",
  fail: "未通过",
};

const SCENARIO_LABELS = {
  refusal: "明确拒绝",
  short_replies: "连续短回复",
  motive_question: "追问动机",
  low_mood: "情绪低落",
  user_approaches: "用户主动靠近",
  important_other: "提及重要他人",
  out_of_character_request: "违背人设请求",
  long_conversation_progress: "长对话推进",
};

const CHARACTER_GROUPS = [
  {
    key: "publicInfo",
    title: "公开信息",
    fields: [
      ["name", "角色名称", 2],
      ["oneLiner", "一句话介绍", 3],
      ["appearance", "外貌描述", 4],
      ["tags", "标签（每行一项）", 3, "lines"],
    ],
  },
  {
    key: "persona",
    title: "内部人设",
    fields: [
      ["identity", "身份", 3],
      ["background", "背景", 5],
      ["currentGoal", "当前目标", 3],
      ["secret", "秘密", 3],
      ["desire", "欲望", 3],
      ["fear", "恐惧", 3],
      ["contradiction", "内在矛盾", 4],
      ["concreteBehaviors", "具体行为（每行一项）", 5, "lines"],
      ["initiativeRules", "主动规则（每行一项）", 5, "lines"],
      ["forbiddenBehaviors", "禁止行为（每行一项）", 5, "lines"],
    ],
  },
  {
    key: "relationship",
    title: "关系推进",
    fields: [
      ["initialRelation", "初始关系", 3],
      ["attractionConditions", "吸引条件（每行一项）", 4, "lines"],
      ["conflictPattern", "冲突模式", 4],
      ["repairPattern", "修复模式", 4],
    ],
  },
  {
    key: "dialogueStyle",
    title: "对话风格",
    fields: [
      ["addressStyle", "称呼方式", 3],
      ["sentenceStyle", "句式特点", 3],
      ["replyLength", "回复长度", 3],
      ["actionNarration", "动作叙述", 3],
      ["emotionalExpression", "情绪表达", 3],
      ["bannedPhrases", "禁用短语（每行一项）", 4, "lines"],
    ],
  },
  {
    key: "openings",
    title: "三种开场",
    fields: [
      ["plotOpening", "剧情开场", 6],
      ["dailyOpening", "日常开场", 6],
      ["tensionOpening", "张力开场", 6],
    ],
  },
  {
    key: "imageDesign",
    title: "形象设计",
    fields: [
      ["appearancePrompt", "外貌提示词", 6],
      ["styleSuggestion", "风格建议", 3],
    ],
  },
];

function isPending(state, action) {
  return state.loading && state.pendingAction === action;
}

function disabled(state, condition = false) {
  return state.loading || condition ? " disabled" : "";
}

function canVisitStep(state, step) {
  if (step <= 1) {
    return true;
  }
  if (step === 2) {
    return state.project.concepts.length === 3;
  }
  if (step <= 4) {
    return Boolean(state.project.character);
  }
  if (step === 5) {
    return Boolean(state.project.ruleReport && state.project.simulationReport);
  }
  return state.project.platformPacks.length > 0;
}

function renderHeader(state, model) {
  return `
    <header class="app-header">
      <div>
        <p class="eyebrow">女性向角色策划工具</p>
        <h1>角色策划与猫箱输入包生成器</h1>
      </div>
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
        ${STEPS.map((label, index) => {
          const accessible = canVisitStep(state, index);
          return `
            <li>
              <button
                type="button"
                class="step-button${state.currentStep === index ? " is-current" : ""}"
                data-action="go-step"
                data-step="${index}"
                ${state.currentStep === index ? 'aria-current="step"' : ""}
                ${disabled(state, !accessible)}
              >
                <span>${index}</span>${escapeHtml(label)}
              </button>
            </li>`;
        }).join("")}
      </ol>
    </nav>`;
}

function renderFeedback(state) {
  return `
    ${state.error ? `<div class="message message-error" role="alert"><strong>操作未完成</strong><p>${escapeHtml(state.error)}</p></div>` : ""}
    ${state.notice ? `<div class="message message-success" role="status">${escapeHtml(state.notice)}</div>` : ""}
    ${state.loading ? `<div class="loading-bar" role="status" aria-live="polite">正在处理，请稍候…</div>` : ""}`;
}

function renderSavedProjects(state, compact = false) {
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

function renderStepZero(state, model) {
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

function renderTextField({ name, label, value, required = false, rows = 0, help = "", type = "text" }) {
  const id = `brief-${name}`;
  const control = rows
    ? `<textarea id="${id}" name="${name}" rows="${rows}"${required ? " required" : ""}>${escapeHtml(value)}</textarea>`
    : `<input id="${id}" name="${name}" type="${type}" value="${escapeHtml(value)}"${required ? " required" : ""} />`;
  return `
    <label class="form-field" for="${id}">
      <span>${escapeHtml(label)}${required ? '<b aria-hidden="true"> *</b>' : ""}</span>
      ${control}
      ${help ? `<small>${escapeHtml(help)}</small>` : ""}
    </label>`;
}

function renderStepOne(state) {
  const brief = state.project.brief;
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 1 / 6</p>
        <h2 id="step-title">创作简报</h2>
        <span>先给出不可妥协的关系与行为约束，再生成三个差异化方向。</span>
      </div>
      ${renderFeedback(state)}
      <form class="brief-form" data-form="creative-brief">
        <section class="card form-section">
          <h3>项目与输出</h3>
          ${renderTextField({ name: "projectTitle", label: "项目标题", value: state.project.title, required: true })}
          <label class="form-field" for="brief-outputMode">
            <span>输出模式 <b aria-hidden="true">*</b></span>
            <select id="brief-outputMode" name="outputMode" required>
              ${Object.entries(OUTPUT_MODE_LABELS).map(([value, label]) => `<option value="${value}"${brief.outputMode === value ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <div class="form-grid">
            ${renderTextField({ name: "characterGender", label: "角色性别", value: brief.characterGender, required: true })}
            ${renderTextField({ name: "ageRange", label: "年龄范围", value: brief.ageRange })}
          </div>
          ${renderTextField({ name: "worldSetting", label: "世界设定", value: brief.worldSetting, required: true, rows: 4 })}
          ${renderTextField({ name: "characterIdentity", label: "角色身份", value: brief.characterIdentity, required: true, rows: 3 })}
          ${renderTextField({ name: "coreExperiences", label: "核心经历", value: arrayToLines(brief.coreExperiences), required: true, rows: 5, help: "每行一项，至少填写一项。" })}
        </section>

        <section class="card form-section">
          <h3>关系与冲突</h3>
          ${renderTextField({ name: "relationshipType", label: "关系类型", value: brief.relationshipType, required: true, rows: 3 })}
          ${renderTextField({ name: "coreConflict", label: "核心冲突", value: brief.coreConflict, required: true, rows: 4 })}
          ${renderTextField({ name: "personalityContradiction", label: "性格矛盾", value: brief.personalityContradiction, rows: 4 })}
          <label class="form-field" for="brief-initiativeLevel">
            <span>主动程度 <b aria-hidden="true">*</b></span>
            <select id="brief-initiativeLevel" name="initiativeLevel" required>
              <option value="low"${brief.initiativeLevel === "low" ? " selected" : ""}>低：以回应为主</option>
              <option value="medium"${brief.initiativeLevel === "medium" ? " selected" : ""}>中：适时主动推进</option>
              <option value="high"${brief.initiativeLevel === "high" ? " selected" : ""}>高：持续主动发起</option>
            </select>
          </label>
          ${renderTextField({ name: "interactionTone", label: "互动基调", value: arrayToLines(brief.interactionTone), rows: 4, help: "每行一项。" })}
        </section>

        <section class="card form-section">
          <h3>边界与补充</h3>
          ${renderTextField({ name: "boundaries", label: "边界", value: arrayToLines(brief.boundaries), rows: 4, help: "每行一项。" })}
          ${renderTextField({ name: "bannedBehaviors", label: "禁用行为", value: arrayToLines(brief.bannedBehaviors), rows: 4, help: "每行一项。" })}
          ${renderTextField({ name: "extraNotes", label: "补充说明", value: brief.extraNotes, rows: 5 })}
        </section>

        <div class="step-actions">
          <button type="button" class="button-secondary" data-action="go-step" data-step="0"${disabled(state)}>返回项目</button>
          <button type="submit" class="button-primary"${disabled(state)}>${isPending(state, "generate-concepts") ? "正在生成…" : "生成三个候选"}</button>
        </div>
      </form>
    </section>`;
}

function renderConceptDetails(concept) {
  const details = [
    ["一句话概念", concept.oneLiner],
    ["核心经历", concept.coreExperience],
    ["初始关系", concept.initialRelation],
    ["核心冲突", concept.coreConflict],
    ["独特行为", concept.uniqueBehavior],
    ["首次互动", concept.firstInteraction],
    ["长期潜力", concept.longTermPotential],
    ["差异说明", concept.differenceSummary],
  ];
  return `<dl class="concept-details">${details.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function renderStepTwo(state) {
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 2 / 6</p>
        <h2 id="step-title">三个候选</h2>
        <span>三个方向只做差异化选择，不评分、不排行。</span>
      </div>
      ${renderFeedback(state)}
      <div class="concept-grid">
        ${state.project.concepts.map((concept, index) => `
          <article class="card concept-card">
            <p class="card-index">候选 ${index + 1}</p>
            <h3>${escapeHtml(concept.name)}</h3>
            ${renderConceptDetails(concept)}
            <button type="button" class="button-primary full-width" data-action="expand-character" data-concept-id="${escapeHtml(concept.id)}"${disabled(state)}>
              ${isPending(state, `expand-${concept.id}`) ? "正在扩展…" : "选择并扩展"}
            </button>
          </article>`).join("")}
      </div>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="1"${disabled(state)}>返回修改简报并重新生成</button>
      </div>
    </section>`;
}

function renderEditableField(state, path, label, rows = 3, valueType = "string") {
  const rawValue = getValueAtPath(state.project.character, path);
  const value = valueType === "lines" ? arrayToLines(rawValue) : rawValue;
  const id = domIdForPath(path);
  const instruction = state.fieldInstructions[path] || "";
  return `
    <article class="editor-field${state.activeFieldPath === path ? " is-active" : ""}" id="${id}" data-field-anchor="${escapeHtml(path)}">
      <div class="field-heading">
        <label for="${id}-value">${escapeHtml(label)}</label>
        <code>${escapeHtml(path)}</code>
      </div>
      <textarea id="${id}-value" rows="${rows}" data-character-path="${escapeHtml(path)}" data-value-type="${valueType}">${escapeHtml(value)}</textarea>
      <div class="regeneration-control">
        <label for="${id}-instruction">修改要求</label>
        <input id="${id}-instruction" type="text" value="${escapeHtml(instruction)}" placeholder="例如：更克制，但给出可观察行为" data-regeneration-instruction="${escapeHtml(path)}" />
        <button type="button" class="button-secondary button-small" data-action="regenerate-field" data-field-path="${escapeHtml(path)}"${disabled(state)}>
          ${isPending(state, `regenerate-${path}`) ? "正在重写…" : "只重写此字段"}
        </button>
      </div>
    </article>`;
}

function renderMetadataFields(state) {
  const fields = [
    ["meta.id", "角色 ID"],
    ["meta.name", "元数据名称"],
    ["meta.createdAt", "创建时间"],
    ["meta.updatedAt", "更新时间"],
  ];
  return `
    <section class="repeater" data-field-anchor="meta">
      <div class="repeater-heading">
        <div><h4>契约元数据</h4><code>meta</code></div>
      </div>
      <div class="editor-fields">
        ${fields.map(([path, label]) => {
          const id = domIdForPath(path);
          return `
            <article class="editor-field${state.activeFieldPath === path ? " is-active" : ""}" id="${id}" data-field-anchor="${escapeHtml(path)}">
              <div class="field-heading">
                <label for="${id}-value">${escapeHtml(label)}</label>
                <code>${escapeHtml(path)}</code>
              </div>
              <textarea id="${id}-value" rows="2" data-character-path="${escapeHtml(path)}">${escapeHtml(getValueAtPath(state.project.character, path))}</textarea>
            </article>`;
        }).join("")}
      </div>
    </section>`;
}

function renderStages(state) {
  const stages = state.project.character.relationship.stages;
  return `
    <section class="repeater" data-field-anchor="relationship.stages">
      <div class="repeater-heading">
        <div><h4>关系阶段</h4><code>relationship.stages</code></div>
        <button type="button" class="button-secondary button-small" data-action="add-repeater" data-repeater="stages"${disabled(state)}>添加阶段</button>
      </div>
      ${stages.length === 0 ? '<p class="empty-state">暂无阶段，可添加一项。</p>' : ""}
      ${stages.map((stage, index) => `
        <article class="repeater-card">
          <div class="repeater-card-heading">
            <h5>阶段 ${index + 1}</h5>
            <button type="button" class="text-button danger-text" data-action="remove-repeater" data-repeater="stages" data-index="${index}"${disabled(state)}>删除</button>
          </div>
          ${renderEditableField(state, `relationship.stages.${index}.name`, "阶段名称", 2)}
          ${renderEditableField(state, `relationship.stages.${index}.trigger`, "触发条件", 3)}
          ${renderEditableField(state, `relationship.stages.${index}.behavior`, "行为表现", 4)}
        </article>`).join("")}
    </section>`;
}

function renderExamples(state) {
  const examples = state.project.character.dialogueStyle.examples;
  return `
    <section class="repeater" data-field-anchor="dialogueStyle.examples">
      <div class="repeater-heading">
        <div><h4>对话示例</h4><code>dialogueStyle.examples</code></div>
        <button type="button" class="button-secondary button-small" data-action="add-repeater" data-repeater="examples"${disabled(state)}>添加示例</button>
      </div>
      ${examples.length === 0 ? '<p class="empty-state">暂无示例，可添加一项。</p>' : ""}
      ${examples.map((example, index) => `
        <article class="repeater-card">
          <div class="repeater-card-heading">
            <h5>示例 ${index + 1}</h5>
            <button type="button" class="text-button danger-text" data-action="remove-repeater" data-repeater="examples" data-index="${index}"${disabled(state)}>删除</button>
          </div>
          ${renderEditableField(state, `dialogueStyle.examples.${index}.user`, "用户", 3)}
          ${renderEditableField(state, `dialogueStyle.examples.${index}.character`, "角色", 4)}
        </article>`).join("")}
    </section>`;
}

function renderCharacterGroup(state, group) {
  return `
    <section class="card editor-group" data-field-anchor="${group.key}">
      <div class="section-heading"><h3>${group.title}</h3><code>${group.key}</code></div>
      <div class="editor-fields">
        ${group.fields.map(([field, label, rows, valueType]) => renderEditableField(state, `${group.key}.${field}`, label, rows, valueType)).join("")}
      </div>
      ${group.key === "publicInfo" ? renderMetadataFields(state) : ""}
      ${group.key === "relationship" ? renderStages(state) : ""}
      ${group.key === "dialogueStyle" ? renderExamples(state) : ""}
    </section>`;
}

function renderStepThree(state) {
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 3 / 6</p>
        <h2 id="step-title">完整角色编辑器</h2>
        <span>所有内容字段均可直接编辑。字段重写只应用返回补丁，不会自动保存。</span>
      </div>
      ${renderFeedback(state)}
      <div class="editor-groups">
        ${CHARACTER_GROUPS.map((group) => renderCharacterGroup(state, group)).join("")}
      </div>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="2"${disabled(state)}>返回候选</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="4"${disabled(state)}>进入质量检查</button>
      </div>
    </section>`;
}

function renderRuleReport(state) {
  const report = state.project.ruleReport;
  if (!report) {
    return '<p class="empty-state">尚未运行规则检查。</p>';
  }
  return `
    <div class="report-header">
      <span class="status-pill status-${report.status}">${STATUS_LABELS[report.status] || report.status}</span>
      <span>${report.issues.length} 个问题</span>
    </div>
    ${report.issues.length === 0 ? '<p class="empty-state success-text">没有发现固定规则问题。</p>' : `
      <ol class="issue-list">
        ${report.issues.map((issue) => `
          <li class="issue-card severity-${issue.severity}">
            <div class="issue-heading">
              <span class="status-pill status-${issue.severity}">${issue.severity === "error" ? "错误" : "提醒"}</span>
              <button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(issue.fieldPath)}">${escapeHtml(issue.fieldPath)}</button>
            </div>
            <strong>${escapeHtml(issue.message)}</strong>
            <dl><div><dt>证据</dt><dd>${escapeHtml(issue.evidence)}</dd></div><div><dt>建议</dt><dd>${escapeHtml(issue.suggestedAction)}</dd></div></dl>
          </li>`).join("")}
      </ol>`}`;
}

function renderStringList(items, emptyText = "无") {
  if (!items.length) {
    return `<span class="muted">${emptyText}</span>`;
  }
  return `<ul class="plain-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSimulationReport(state) {
  const report = state.project.simulationReport;
  if (!report) {
    return '<p class="empty-state">尚未运行 8 场景模拟。</p>';
  }
  return `
    <div class="report-header">
      <span class="status-pill status-${report.status}">${STATUS_LABELS[report.status] || report.status}</span>
      <span>正好 ${report.scenarios.length} 个场景</span>
    </div>
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
            <div><dt>建议字段</dt><dd>${scenario.suggestedFields.length
              ? `<div class="field-links">${scenario.suggestedFields.map((path) => `<button type="button" class="field-link" data-action="go-field" data-field-path="${escapeHtml(path)}">${escapeHtml(path)}</button>`).join("")}</div>`
              : '<span class="muted">无</span>'}</dd></div>
          </dl>
        </article>`).join("")}
    </div>`;
}

function renderStepFour(state) {
  const reportsReady = state.project.ruleReport && state.project.simulationReport;
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 4 / 6</p>
        <h2 id="step-title">质量检查</h2>
        <span>固定规则与八场景模拟彼此独立，只报告问题，不自动循环重写。</span>
      </div>
      ${renderFeedback(state)}
      <section class="card report-section">
        <div class="section-heading">
          <div><p class="section-kicker">A</p><h3>规则检查</h3></div>
          <button type="button" class="button-primary" data-action="run-rules"${disabled(state)}>${isPending(state, "run-rules") ? "检查中…" : "运行规则检查"}</button>
        </div>
        ${renderRuleReport(state)}
      </section>
      <section class="card report-section">
        <div class="section-heading">
          <div><p class="section-kicker">B</p><h3>8 场景模拟</h3></div>
          <button type="button" class="button-primary" data-action="run-simulation"${disabled(state)}>${isPending(state, "run-simulation") ? "模拟中…" : "运行 8 场景模拟"}</button>
        </div>
        ${renderSimulationReport(state)}
      </section>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="3"${disabled(state)}>返回角色编辑器</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="5"${disabled(state, !reportsReady)}>生成猫箱输入包</button>
      </div>
    </section>`;
}

function packBlockKey(flowId, blockId) {
  return `${flowId}:${blockId}`;
}

function renderPackBlock(state, pack, block) {
  const key = packBlockKey(pack.flowId, block.id);
  const overBy = block.maxLength === null ? 0 : Math.max(0, block.currentLength - block.maxLength);
  return `
    <article class="pack-block">
      <div class="field-heading">
        <label for="pack-${escapeHtml(key)}">${escapeHtml(block.label)}</label>
        <code>${escapeHtml(block.id)}</code>
      </div>
      <textarea id="pack-${escapeHtml(key)}" rows="8" data-pack-flow="${escapeHtml(pack.flowId)}" data-pack-block="${escapeHtml(block.id)}">${escapeHtml(block.text)}</textarea>
      <div class="pack-meta">
        <span data-pack-length="${escapeHtml(key)}">当前 ${block.currentLength} 字</span>
        <span>${block.maxLength === null ? "上限未知（平台未显示）" : `上限 ${block.maxLength} 字`}</span>
        <span class="status-pill ${block.valid ? "status-pass" : "status-fail"}" data-pack-valid="${escapeHtml(key)}">${block.valid ? "有效" : "需调整"}</span>
        <span class="status-pill ${block.verified ? "status-neutral" : "status-warning"}">${block.verified ? "规则已核验" : "平台限制未核验"}</span>
      </div>
      <p class="over-limit${overBy > 0 ? " is-visible" : ""}" data-pack-over="${escapeHtml(key)}">${overBy > 0 ? `超出 ${overBy} 字` : ""}</p>
      <button type="button" class="button-secondary button-small" data-action="copy-pack-block" data-pack-flow="${escapeHtml(pack.flowId)}" data-pack-block="${escapeHtml(block.id)}"${disabled(state)}>复制文本</button>
    </article>`;
}

function renderStepFive(state) {
  const flowId = state.project.brief.outputMode;
  const pack = state.project.platformPacks.find((item) => item.flowId === flowId);
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 5 / 6</p>
        <h2 id="step-title">猫箱输入包</h2>
        <span>当前入口：${escapeHtml(OUTPUT_MODE_LABELS[flowId] || flowId)}。不会自动截断或反写角色草稿。</span>
      </div>
      ${renderFeedback(state)}
      <section class="card pack-section">
        <div class="section-heading">
          <div><p class="section-kicker">${escapeHtml(flowId)}</p><h3>${escapeHtml(OUTPUT_MODE_LABELS[flowId] || flowId)}</h3></div>
          <button type="button" class="button-primary" data-action="generate-pack"${disabled(state)}>${isPending(state, "generate-pack") ? "生成中…" : pack ? "重新生成输入包" : "生成输入包"}</button>
        </div>
        ${pack
          ? `<div class="pack-blocks">${pack.blocks.map((block) => renderPackBlock(state, pack, block)).join("")}</div>`
          : '<p class="empty-state">尚未生成当前入口的输入包。</p>'}
      </section>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="4"${disabled(state)}>返回质量检查</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="6"${disabled(state, !pack)}>保存与导出</button>
      </div>
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

function renderStepSix(state) {
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

function renderCurrentStep(state, model) {
  switch (state.currentStep) {
    case 0:
      return renderStepZero(state, model);
    case 1:
      return renderStepOne(state);
    case 2:
      return renderStepTwo(state);
    case 3:
      return renderStepThree(state);
    case 4:
      return renderStepFour(state);
    case 5:
      return renderStepFive(state);
    case 6:
      return renderStepSix(state);
    default:
      return renderStepZero(state, model);
  }
}

export function renderApp(state, { model }) {
  return `
    <div class="app-shell"${state.loading ? ' aria-busy="true"' : ""}>
      ${renderHeader(state, model)}
      ${renderStepper(state)}
      <main class="main-content">
        ${renderCurrentStep(state, model)}
      </main>
      <footer>内容仅保存在当前浏览器；真实模式的密钥由本地代理处理。</footer>
    </div>`;
}

export { SCENARIO_LABELS };
