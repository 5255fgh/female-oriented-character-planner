/**
 * 递归冻结声明式规则，避免验证来源在运行时被修改。
 *
 * @template {object} T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

const UNKNOWN_PUBLIC_LIMIT =
  "任务 30：公开资料未确认该字段长度；maxLength 必须保持 null，等待实机证据。";

const STORY_PROMPT_RULE = {
  required: true,
  maxLength: 10000,
  allowedValues: null,
  verified: true,
  verifiedAt: null,
  evidenceNote:
    "PROJECT_SPEC.md 第 4 节记录 open_story.storyPrompt 最大 10000 字；当前仓库未记录复核日期。",
};

/**
 * 猫箱字段规则的唯一来源。每个字段都显式记录必填、长度、枚举和证据状态；
 * 未确认长度不使用推测值。
 */
export const MAOXIANG_RULES = deepFreeze({
  editor_character: {
    roleName: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    roleIntroduction: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    roleSetting: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    sceneSetting: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    openingMessage: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    dialogueExamples: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    imagePrompt: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    voiceSuggestion: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
  },
  free_character: {
    characterPrompt: {
      required: true,
      maxLength: 1000,
      allowedValues: null,
      verified: true,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节记录 free_character.characterPrompt 最大 1000 字，并标记为实机截图确认；截图日期未记录。",
    },
  },
  dead_rival: {
    rivalSetting: {
      required: true,
      maxLength: 300,
      allowedValues: null,
      verified: true,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节记录 dead_rival.rivalSetting 最大 300 字并标记已确认；确认日期未记录。",
    },
    history: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节明确 dead_rival.history 上限未知，不作臆测性限制。",
    },
    other: {
      required: false,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节明确 dead_rival.other 上限未知，且该字段可选。",
    },
  },
  image_shape: {
    imagePrompt: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节明确 image_shape.imagePrompt 上限未知，不作臆测性限制。",
    },
    styleSuggestion: {
      required: true,
      maxLength: null,
      allowedValues: ["通用", "像素画", "言情漫画", "细腻厚涂"],
      verified: true,
      verifiedAt: null,
      evidenceNote:
        "PROJECT_SPEC.md 第 4 节锁定 image_shape.styleSuggestion 的四项枚举；复核日期未记录。",
    },
  },
  editor_open_story: {
    storyTitle: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    mainCharacters: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    storyFoundation: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    storyContent: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    openingMessage: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    chapterOutline: {
      required: true,
      maxLength: null,
      allowedValues: null,
      verified: false,
      verifiedAt: null,
      evidenceNote: UNKNOWN_PUBLIC_LIMIT,
    },
    storyPrompt: STORY_PROMPT_RULE,
  },
  // 兼容旧 PlatformPack 契约；新统一入口使用 editor_open_story。
  open_story: {
    storyPrompt: STORY_PROMPT_RULE,
  },
});

export const MAOXIANG_FIELD_LABELS = deepFreeze({
  editor_character: {
    roleName: "角色名称",
    roleIntroduction: "角色简介",
    roleSetting: "角色设定",
    sceneSetting: "场景设定",
    openingMessage: "开场白",
    dialogueExamples: "对话示例",
    imagePrompt: "形象描述",
    voiceSuggestion: "语音建议",
  },
  free_character: {
    characterPrompt: "输入你想创建的角色",
  },
  dead_rival: {
    rivalSetting: "死对头的设定",
    history: "历史纠葛",
    other: "其他（选填）",
  },
  image_shape: {
    imagePrompt: "输入你脑海中的形象",
    styleSuggestion: "推荐风格",
  },
  editor_open_story: {
    storyTitle: "故事标题",
    mainCharacters: "主要角色",
    storyFoundation: "故事基础",
    storyContent: "故事内容",
    openingMessage: "开场白",
    chapterOutline: "章节大纲",
    storyPrompt: "故事提示词",
  },
  open_story: {
    storyPrompt: "开放故事",
  },
});

export const MAOXIANG_FLOW_STATUS = deepFreeze({
  editor_character: { enabled: true },
  free_character: { enabled: true },
  dead_rival: { enabled: true },
  image_shape: { enabled: true },
  editor_open_story: { enabled: true },
  open_story: { enabled: false },
});

export const MAOXIANG_ADAPTER_FLOW_IDS = Object.freeze([
  "editor_character",
  "free_character",
  "dead_rival",
  "image_shape",
  "editor_open_story",
]);

/**
 * @param {string} flowId
 * @returns {Record<string, Readonly<Record<string, unknown>>>}
 */
export function getMaoxiangRules(flowId) {
  const rules = MAOXIANG_RULES[flowId];
  if (!rules) {
    throw new Error(`MAOXIANG_RULES.${String(flowId)}: unknown flowId`);
  }
  return rules;
}
