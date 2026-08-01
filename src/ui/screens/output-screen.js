import { escapeHtml } from "../dom.js";
import { disabled, OUTPUT_MODE_LABELS, renderFeedback } from "../rendering.js";

function renderPackBlock(state, pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const overBy = block.maxLength === null
    ? 0
    : Math.max(0, block.currentLength - block.maxLength);
  const emptyRequired = !block.valid && block.text.trim().length === 0;
  const invalidReason = overBy > 0
    ? `已知超限 ${overBy} 字；保留全文，不会自动截断。`
    : emptyRequired
      ? "必填字段为空。"
      : !block.valid
        ? "字段不满足已知平台规则。"
        : "";

  return `
    <article class="pack-block${block.valid ? "" : " pack-invalid"}" data-pack-validity="${block.valid ? "valid" : "invalid"}">
      <div class="field-heading"><label for="pack-${escapeHtml(key)}">${escapeHtml(block.label)}</label><code>${escapeHtml(block.id)}</code></div>
      <textarea id="pack-${escapeHtml(key)}" rows="8" data-pack-flow="${escapeHtml(pack.flowId)}" data-pack-block="${escapeHtml(block.id)}">${escapeHtml(block.text)}</textarea>
      <div class="pack-meta">
        <span data-pack-length="${escapeHtml(key)}">${block.currentLength} 字</span>
        <span>${block.maxLength === null ? "上限未确认" : `已知上限 ${block.maxLength} 字`}</span>
        <span class="status-pill ${block.valid ? "status-pass" : "status-fail"}" data-pack-valid="${escapeHtml(key)}">${block.valid ? "有效" : "无效"}</span>
        <span class="status-pill ${block.verified ? "status-neutral" : "status-warning"}">${block.verified ? "规则已核验" : "限制未确认"}</span>
      </div>
      <p class="over-limit${invalidReason ? " is-visible" : ""}" data-pack-over="${escapeHtml(key)}">${escapeHtml(invalidReason)}</p>
      <button type="button" class="button-secondary button-small" data-action="copy-pack-block" data-pack-flow="${escapeHtml(pack.flowId)}" data-pack-block="${escapeHtml(block.id)}" data-copy-valid="${String(block.valid)}"${disabled(state, !block.valid)}>复制此字段</button>
    </article>`;
}

export function renderPlatformOutput(state) {
  const expectedFlow = state.projectKind === "story"
    ? "editor_open_story"
    : "editor_character";
  const packs = Array.isArray(state.project.platformPacks)
    ? state.project.platformPacks
    : [];
  const pack = packs.find((item) => item.flowId === expectedFlow) || packs[0] || null;
  const allValid = Boolean(pack && pack.blocks.every((block) => block.valid));

  return `
    <section class="card pack-section" id="platform-output" aria-labelledby="output-title">
      <div class="section-heading">
        <div><p class="section-kicker">平台输出</p><h3 id="output-title">${escapeHtml(OUTPUT_MODE_LABELS[pack?.flowId || expectedFlow] || pack?.flowId || expectedFlow)}</h3></div>
        ${pack ? `<button type="button" class="button-primary button-small" data-action="copy-pack" data-pack-flow="${escapeHtml(pack.flowId)}" data-copy-valid="${String(allValid)}"${disabled(state, !allValid)}>复制整包</button>` : ""}
      </div>
      <p class="helper-text">Unicode 字数实时计算；未确认上限不会被猜测，已知超限不会截断。</p>
      ${pack
        ? `<div class="pack-blocks">${pack.blocks.map((block) => renderPackBlock(state, pack, block)).join("")}</div>`
        : '<div class="empty-state"><p>角色或故事已修改，平台文本需要重新生成。</p><button type="button" class="button-secondary" data-action="run-postprocess">生成平台文本</button></div>'}
    </section>`;
}

// 兼容旧入口。
export function renderOutputScreen(state) {
  return `<section class="step-panel">${renderFeedback(state)}${renderPlatformOutput(state)}</section>`;
}
