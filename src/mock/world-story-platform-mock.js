import {
  assertStoryDraft,
  assertWorldBible,
} from "../contracts.js";
import { createMockLLMClient } from "./mock-llm-client.js";

/** @type {import("../contracts.js").WorldBible} */
const WORLD_BIBLE = {
  summary: "王城以可追溯的档案维持权力秩序，旧案真相会直接改变家族与议会的关系。",
  rules: [
    "议会裁决必须引用仍存档的原始证据。",
    "禁书库卷宗未经双人登记不得带离。",
    "家族契约可以保全资产，但不能覆盖刑事责任。",
  ],
  locations: ["王城禁书库", "议会审理厅", "旧药铺"],
  factions: ["王城议会", "档案官联合会", "没落旧贵族"],
  canonFacts: ["十年前旧案的原始誊本仍然存在。", "沈砚舟的家族因伪证失去爵位。"],
  forbiddenFacts: ["不得把议会写成全知且绝对正确的机构。", "不得用超自然力量直接抹去证据。"],
};

/** @type {import("../contracts.js").StoryDraft} */
const STORY_DRAFT = {
  title: "雨夜卷宗",
  oneLiner: "你与契约盟友必须在议会销毁旧档前公开一份会同时伤害双方家族的证据。",
  userIdentity: "掌握旧案旁证、拥有临时档案查阅权的没落家族继承人",
  mainCharacters: ["你", "沈砚舟"],
  premise: "一场暴雨封锁王城，禁书库即将在黎明接受议会清点。",
  coreConflict: "公开真相会洗清沈家，却也会揭露你的监护人参与伪证。",
  initialScene: "你在封禁书库找到写有自己姓氏的旧卷，沈砚舟先一步按住封条。",
  openingLine: "雨声盖住门外脚步，他把封条转向你：‘拆开之前，你仍有离开的选择。’",
  keyNodes: [
    "确认旧卷的原始编号与缺页位置。",
    "在议会清点前找到第二名登记人。",
    "发现你的监护人留下的矛盾证词。",
    "决定是否把部分真相告知沈砚舟。",
    "潜入封存室取得原始誊本。",
    "面对议会提出的交换条件。",
    "选择公开证据的范围与时机。",
    "共同承担裁决结果并重新定义关系。",
  ],
  branches: ["优先保护证人", "公开全部证据", "先争取议会内部盟友"],
  foreshadowing: ["卷宗边缘的双人暗号", "旧火伤与缺页烧痕一致", "药铺账本记录了陌生取件人"],
  stateVariables: [],
};

/** @param {unknown} value */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} request
 * @returns {string}
 */
function readTask(request) {
  if (request === null || typeof request !== "object") {
    throw new Error("LLMClient.request: expected an object");
  }
  const task = /** @type {{task?: unknown}} */ (request).task;
  if (typeof task !== "string" || task.length === 0) {
    throw new Error("LLMClient.request.task: expected a non-empty string");
  }
  return task;
}

/**
 * @param {unknown} request
 * @returns {Record<string, string>}
 */
function createCompressedFieldResponse(request) {
  const messages = /** @type {{messages?: unknown}} */ (request).messages;
  if (!Array.isArray(messages)) {
    return {};
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message === null || typeof message !== "object") {
      continue;
    }
    const content = /** @type {{content?: unknown}} */ (message).content;
    if (typeof content !== "string") {
      continue;
    }
    try {
      const payload = JSON.parse(content);
      if (payload?.operation !== "compress-known-over-limit-fields-once") {
        continue;
      }
      return Object.fromEntries(
        Object.keys(payload.fields || {}).map((fieldId) => [
          fieldId,
          fieldId === "characterPrompt"
            ? "沈砚舟是克制守序的王城档案官，与你以契约盟友身份追查旧案。他重视证据与边界，主动提供方案但保留你的决定权。"
            : fieldId === "rivalSetting"
              ? "沈砚舟是与你长期竞争的王城档案官。旧案让你们从宿敌变成不得不合作的盟友；他冷静守规，却尊重你的选择。"
              : fieldId === "storyPrompt"
                ? "保持开放互动，以八个关键节点推进核心冲突，不扩写几十章正文，不违背既定事实。"
                : `已压缩字段：${fieldId}`,
        ]),
      );
    } catch {
      continue;
    }
  }
  return {};
}

/**
 * 创建包含 World/Story/平台压缩任务的稳定 mock，并把其他任务委托给共享 mock。
 */
export function createWorldStoryPlatformMockLLMClient() {
  const baseClient = createMockLLMClient();
  return {
    async completeJson(request) {
      const task = readTask(request);
      if (task === "world-generation") {
        return assertWorldBible(clone(WORLD_BIBLE));
      }
      if (task === "story-generation") {
        return assertStoryDraft(clone(STORY_DRAFT));
      }
      if (task === "maoxiang-compress-fields") {
        return createCompressedFieldResponse(request);
      }
      return baseClient.completeJson(request);
    },
    async completeText(request) {
      const task = readTask(request);
      if (task === "world-generation") {
        return WORLD_BIBLE.summary;
      }
      if (task === "story-generation") {
        return STORY_DRAFT.oneLiner;
      }
      if (task === "maoxiang-compress-fields") {
        return "已压缩已知超限字段。";
      }
      return baseClient.completeText(request);
    },
  };
}
