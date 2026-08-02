import { escapeHtml } from "../dom.js";
import { disabled, OUTPUT_MODE_LABELS } from "../rendering.js";
import {
  canCopyPlatformBlock,
  canCopyPlatformPack,
  isCharacterArtifactStale,
} from "../platform-copy.js";

const CHARACTER_FLOW_IDS = Object.freeze([
  "editor_character",
  "free_character",
  "dead_rival",
  "image_shape",
]);

function getSupportedFlowIds(state) {
  return state.projectKind === "story"
    ? ["editor_open_story"]
    : CHARACTER_FLOW_IDS;
}

function isPackStale(state, pack) {
  if (!state.project.character) return false;
  const characterUpdatedAt = Date.parse(state.project.character.meta.updatedAt);
  const packGeneratedAt = Date.parse(pack.generatedAt);
  return !Number.isFinite(packGeneratedAt) || packGeneratedAt < characterUpdatedAt;
}

function renderPackBlock(state, pack, block) {
  const key = `${pack.flowId}:${block.id}`;
  const overBy = block.maxLength === null
    ? 0
    : Math.max(0, block.currentLength - block.maxLength);
  const emptyRequired = !block.valid && block.text.trim().length === 0;
  const copyAllowed = canCopyPlatformBlock(state, block);
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
        <span>${block.maxLength === null ? "平台上限尚未核验" : `已知上限 ${block.maxLength} 字`}</span>
        <span class="status-pill ${block.valid ? "status-pass" : "status-fail"}" data-pack-valid="${escapeHtml(key)}">${block.valid ? "有效" : "无效"}</span>
        ${block.verified ? '<span class="status-pill status-neutral">规则已核验</span>' : ""}
      </div>
      <p class="over-limit${invalidReason ? " is-visible" : ""}" data-pack-over="${escapeHtml(key)}">${escapeHtml(invalidReason)}</p>
      <button type="button" class="button-secondary button-small" data-action="copy-pack-block" data-pack-flow="${escapeHtml(pack.flowId)}" data-pack-block="${escapeHtml(block.id)}" data-copy-valid="${String(copyAllowed)}"${disabled(state, !copyAllowed)}>复制此字段</button>
    </article>`;
}

function renderPack(state, pack) {
  const allValid = canCopyPlatformPack(state, pack);
  const stale = isPackStale(state, pack);
  const hasBlockingRuleError =
    state.projectKind === "character" &&
    state.project.ruleReport?.status === "fail" &&
    !isCharacterArtifactStale(state.project, "quick-check");

  return `
    <section class="pack-variant" data-pack-flow-section="${escapeHtml(pack.flowId)}">
      <div class="section-heading">
        <div><h4>${escapeHtml(OUTPUT_MODE_LABELS[pack.flowId] || pack.flowId)}</h4><code>${escapeHtml(pack.flowId)}</code></div>
        <button type="button" class="button-primary button-small" data-action="copy-pack" data-pack-flow="${escapeHtml(pack.flowId)}" data-copy-valid="${String(allValid)}"${disabled(state, !allValid)}>复制整包</button>
      </div>
      ${stale ? '<p class="message-inline">该输入包基于修改前的角色，可能已过期；仍可复制或单独重新生成。</p>' : ""}
      ${hasBlockingRuleError ? '<p class="message-inline error-text">最新固定规则仍有错误；修复后才能复制。提醒不会阻止复制。</p>' : ""}
      <div class="pack-blocks">${pack.blocks.map((block) => renderPackBlock(state, pack, block)).join("")}</div>
    </section>`;
}

export function renderPlatformOutput(state) {
  const supportedFlowIds = getSupportedFlowIds(state);
  const packsByFlow = new Map(
    (Array.isArray(state.project.platformPacks) ? state.project.platformPacks : [])
      .map((pack) => [pack.flowId, pack]),
  );
  const packs = supportedFlowIds
    .map((flowId) => packsByFlow.get(flowId))
    .filter(Boolean);

  return `
    <section class="card pack-section" id="platform-output" aria-labelledby="output-title">
      <div class="section-heading">
        <div><p class="section-kicker">平台输出</p><h3 id="output-title">猫箱输入包</h3></div>
      </div>
      <p class="helper-text">输入包可独立生成，不要求先运行质量检查。平台上限尚未核验的字段仍可生成、保存和复制；已知超限不会截断。</p>
      <div class="inline-actions platform-generation-actions">
        ${supportedFlowIds.map((flowId) => `
          <button type="button" class="button-secondary button-small" data-action="generate-platform-pack" data-pack-flow="${escapeHtml(flowId)}"${disabled(state)}>${packsByFlow.has(flowId) ? "重新生成" : "生成"}${escapeHtml(OUTPUT_MODE_LABELS[flowId] || flowId)}</button>
        `).join("")}
      </div>
      ${packs.length > 0
        ? packs.map((pack) => renderPack(state, pack)).join("")
        : '<p class="empty-state">尚未生成平台文本，可从上方选择当前项目支持的输入包。</p>'}
    </section>`;
}
