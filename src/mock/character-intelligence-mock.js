import {
  assertCharacterDraft,
  assertCreativeBrief,
} from "../contracts.js";

const SEED_ANALYSIS_QUESTIONS = [
  {
    prompt: "这段关系主要发生在怎样的世界背景中？",
    options: ["现代都市", "东方幻想", "西式奇幻", "近未来"],
    recommended: "现代都市",
  },
  {
    prompt: "你更希望双方以哪种关系机制开始互动？",
    options: [
      "势均力敌的合作伙伴",
      "针锋相对的宿敌",
      "久别重逢的旧识",
      "有明确期限的契约关系",
    ],
    recommended: "势均力敌的合作伙伴",
  },
  {
    prompt: "哪种核心张力最适合推动这名角色主动行动？",
    options: [
      "共同调查高风险秘密",
      "目标一致但价值观冲突",
      "身份立场天然对立",
      "一方隐瞒会改变关系的事实",
    ],
    recommended: "共同调查高风险秘密",
  },
];

/** @type {import("../contracts.js").CreativeBrief} */
const DIRECT_CREATIVE_BRIEF = {
  platform: "maoxiang",
  outputMode: "free_character",
  characterGender: "男",
  ageRange: "25-30",
  worldSetting: "架空王城的禁书库与旧案议会",
  characterIdentity: "禁书库档案官",
  coreExperiences: ["共同查案", "从契约试探走向平等信任"],
  relationshipType: "限期婚约下的利益盟友",
  coreConflict: "公开旧案真相会牵连用户重视的人",
  personalityContradiction: "依赖规则获得安全感，却会为保护他人打破规则",
  initiativeLevel: "high",
  interactionTone: ["克制", "势均力敌", "行动导向"],
  boundaries: ["尊重拒绝", "保留用户决定权", "不限制用户社交"],
  bannedBehaviors: ["无条件服从", "替用户决定", "用自伤或威胁换取承诺"],
  extraNotes: "开场应提供可立即回应的旧案事件。",
};

/** @param {unknown} value @returns {unknown} */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} request
 * @returns {string}
 */
function readSeedText(request) {
  if (request === null || typeof request !== "object") {
    return "";
  }
  const messages = /** @type {{messages?: unknown}} */ (request).messages;
  if (!Array.isArray(messages)) {
    return "";
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
    const match = content.match(/创作种子：("(?:\\.|[^"\\])*")/u);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return "";
      }
    }
  }
  return "";
}

/** @param {string} seedText @returns {boolean} */
function hasSufficientSeedDetails(seedText) {
  if (Array.from(seedText.trim()).length < 36) {
    return false;
  }
  const dimensions = [
    /现代|都市|古代|王城|江湖|仙侠|奇幻|近未来|星际|末世|校园|民国/u,
    /医生|医师|记者|律师|教授|档案官|调查员|猎妖师|军官|演员|身份|继承人/u,
    /宿敌|盟友|搭档|婚约|契约|旧识|青梅|前任|上下级|师徒|竞争/u,
    /冲突|秘密|真相|追查|争夺|背叛|危机|但|却|必须|隐瞒/u,
  ];
  return dimensions.filter((pattern) => pattern.test(seedText)).length >= 3;
}

/**
 * @param {unknown} request
 * @returns {{questions: Array<{prompt: string, options: string[], recommended: string}>}}
 */
export function createSeedAnalysisMockResponse(request) {
  return {
    questions: hasSufficientSeedDetails(readSeedText(request))
      ? []
      : /** @type {typeof SEED_ANALYSIS_QUESTIONS} */ (
          clone(SEED_ANALYSIS_QUESTIONS)
        ),
  };
}

/**
 * @param {import("../contracts.js").CharacterDraft} character
 * @returns {{title: string, brief: import("../contracts.js").CreativeBrief, worldSummary: string, character: import("../contracts.js").CharacterDraft}}
 */
export function createDirectCharacterMockResponse(character) {
  const response = {
    title: "禁书库契约",
    brief: clone(DIRECT_CREATIVE_BRIEF),
    worldSummary: "王城议会准备销毁一批旧案卷宗，禁书库成为各方争夺证据的最后地点。",
    character: clone(character),
  };
  assertCreativeBrief(response.brief);
  assertCharacterDraft(response.character);
  return response;
}
