import { getValueAtPath } from "../../contracts.js";
import { arrayToLines, domIdForPath, escapeHtml } from "../dom.js";
import { disabled, isPending, renderFeedback } from "../rendering.js";

const CHARACTER_GROUPS = [
  {
    key: "publicInfo",
    title: "公开信息",
    fields: [
      ["name", "角色名称", 2], ["oneLiner", "一句话介绍", 3],
      ["appearance", "外貌描述", 4], ["tags", "标签（每行一项）", 3, "lines"],
    ],
  },
  {
    key: "persona",
    title: "内部人设",
    fields: [
      ["identity", "身份", 3], ["background", "背景", 5],
      ["currentGoal", "当前目标", 3], ["secret", "秘密", 3],
      ["desire", "欲望", 3], ["fear", "恐惧", 3],
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
      ["conflictPattern", "冲突模式", 4], ["repairPattern", "修复模式", 4],
    ],
  },
  {
    key: "dialogueStyle",
    title: "对话风格",
    fields: [
      ["addressStyle", "称呼方式", 3], ["sentenceStyle", "句式特点", 3],
      ["replyLength", "回复长度", 3], ["actionNarration", "动作叙述", 3],
      ["emotionalExpression", "情绪表达", 3],
      ["bannedPhrases", "禁用短语（每行一项）", 4, "lines"],
    ],
  },
  {
    key: "openings",
    title: "三种开场",
    fields: [
      ["plotOpening", "剧情开场", 6], ["dailyOpening", "日常开场", 6],
      ["tensionOpening", "张力开场", 6],
    ],
  },
  {
    key: "imageDesign",
    title: "形象设计",
    fields: [["appearancePrompt", "外貌提示词", 6], ["styleSuggestion", "风格建议", 3]],
  },
];

function renderConceptDetails(concept) {
  const details = [
    ["一句话概念", concept.oneLiner], ["核心经历", concept.coreExperience],
    ["初始关系", concept.initialRelation], ["核心冲突", concept.coreConflict],
    ["独特行为", concept.uniqueBehavior], ["首次互动", concept.firstInteraction],
    ["长期潜力", concept.longTermPotential], ["差异说明", concept.differenceSummary],
  ];
  return `<dl class="concept-details">${details.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

export function renderConceptScreen(state) {
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
    ["meta.id", "角色 ID"], ["meta.name", "元数据名称"],
    ["meta.createdAt", "创建时间"], ["meta.updatedAt", "更新时间"],
  ];
  return `
    <section class="repeater" data-field-anchor="meta">
      <div class="repeater-heading"><div><h4>契约元数据</h4><code>meta</code></div></div>
      <div class="editor-fields">
        ${fields.map(([path, label]) => {
          const id = domIdForPath(path);
          return `
            <article class="editor-field${state.activeFieldPath === path ? " is-active" : ""}" id="${id}" data-field-anchor="${escapeHtml(path)}">
              <div class="field-heading"><label for="${id}-value">${escapeHtml(label)}</label><code>${escapeHtml(path)}</code></div>
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
          <div class="repeater-card-heading"><h5>阶段 ${index + 1}</h5><button type="button" class="text-button danger-text" data-action="remove-repeater" data-repeater="stages" data-index="${index}"${disabled(state)}>删除</button></div>
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
          <div class="repeater-card-heading"><h5>示例 ${index + 1}</h5><button type="button" class="text-button danger-text" data-action="remove-repeater" data-repeater="examples" data-index="${index}"${disabled(state)}>删除</button></div>
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

export function renderCharacterScreen(state) {
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 3 / 6</p>
        <h2 id="step-title">完整角色编辑器</h2>
        <span>所有内容字段均可直接编辑。字段重写只应用返回补丁，不会自动保存。</span>
      </div>
      ${renderFeedback(state)}
      <div class="editor-groups">${CHARACTER_GROUPS.map((group) => renderCharacterGroup(state, group)).join("")}</div>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="2"${disabled(state)}>返回候选</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="4"${disabled(state)}>进入质量检查</button>
      </div>
    </section>`;
}
