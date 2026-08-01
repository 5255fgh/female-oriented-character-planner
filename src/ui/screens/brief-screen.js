import { escapeHtml } from "../dom.js";
import {
  disabled,
  isPending,
  OUTPUT_MODE_LABELS,
  renderFeedback,
} from "../rendering.js";

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

export function renderBriefScreen(state) {
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
          ${renderTextField({ name: "coreExperiences", label: "核心经历", value: brief.coreExperiences.join("\n"), required: true, rows: 5, help: "每行一项，至少填写一项。" })}
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
          ${renderTextField({ name: "interactionTone", label: "互动基调", value: brief.interactionTone.join("\n"), rows: 4, help: "每行一项。" })}
        </section>
        <section class="card form-section">
          <h3>边界与补充</h3>
          ${renderTextField({ name: "boundaries", label: "边界", value: brief.boundaries.join("\n"), rows: 4, help: "每行一项。" })}
          ${renderTextField({ name: "bannedBehaviors", label: "禁用行为", value: brief.bannedBehaviors.join("\n"), rows: 4, help: "每行一项。" })}
          ${renderTextField({ name: "extraNotes", label: "补充说明", value: brief.extraNotes, rows: 5 })}
        </section>
        <div class="step-actions">
          <button type="button" class="button-secondary" data-action="go-step" data-step="0"${disabled(state)}>返回项目</button>
          <button type="submit" class="button-primary"${disabled(state)}>${isPending(state, "generate-concepts") ? "正在生成…" : "生成三个候选"}</button>
        </div>
      </form>
    </section>`;
}
