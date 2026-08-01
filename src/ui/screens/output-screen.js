import { escapeHtml } from "../dom.js";
import {
  disabled,
  isPending,
  OUTPUT_MODE_LABELS,
  renderFeedback,
} from "../rendering.js";

function renderPackBlock(state, pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const overBy = block.maxLength === null ? 0 : Math.max(0, block.currentLength - block.maxLength);
  return `
    <article class="pack-block">
      <div class="field-heading"><label for="pack-${escapeHtml(key)}">${escapeHtml(block.label)}</label><code>${escapeHtml(block.id)}</code></div>
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

export function renderOutputScreen(state) {
  const flowId = state.project.brief.outputMode;
  const pack = state.project.platformPacks.find((item) => item.flowId === flowId);
  return `
    <section class="step-panel" aria-labelledby="step-title">
      <div class="step-heading">
        <p>步骤 5 / 6</p><h2 id="step-title">猫箱输入包</h2>
        <span>当前入口：${escapeHtml(OUTPUT_MODE_LABELS[flowId] || flowId)}。不会自动截断或反写角色草稿。</span>
      </div>
      ${renderFeedback(state)}
      <section class="card pack-section">
        <div class="section-heading">
          <div><p class="section-kicker">${escapeHtml(flowId)}</p><h3>${escapeHtml(OUTPUT_MODE_LABELS[flowId] || flowId)}</h3></div>
          <button type="button" class="button-primary" data-action="generate-pack"${disabled(state)}>${isPending(state, "generate-pack") ? "生成中…" : pack ? "重新生成输入包" : "生成输入包"}</button>
        </div>
        ${pack ? `<div class="pack-blocks">${pack.blocks.map((block) => renderPackBlock(state, pack, block)).join("")}</div>` : '<p class="empty-state">尚未生成当前入口的输入包。</p>'}
      </section>
      <div class="step-actions">
        <button type="button" class="button-secondary" data-action="go-step" data-step="4"${disabled(state)}>返回质量检查</button>
        <button type="button" class="button-primary" data-action="go-step" data-step="6"${disabled(state, !pack)}>保存与导出</button>
      </div>
    </section>`;
}
