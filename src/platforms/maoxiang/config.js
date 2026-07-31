/**
 * 递归冻结猫箱入口配置，避免字段定义在运行时被修改。
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

export const MAOXIANG_FLOWS = deepFreeze({
  free_character: {
    enabled: true,
    characterPrompt: {
      label: "输入你想创建的角色",
      maxLength: 1000,
      verified: true,
      required: true,
    },
  },
  dead_rival: {
    enabled: true,
    rivalSetting: {
      label: "死对头的设定",
      maxLength: 300,
      verified: true,
      required: true,
    },
    history: {
      label: "历史纠葛",
      maxLength: null,
      verified: false,
      required: true,
    },
    other: {
      label: "其他（选填）",
      maxLength: null,
      verified: false,
      required: false,
    },
  },
  image_shape: {
    enabled: true,
    imagePrompt: {
      label: "输入你脑海中的形象",
      maxLength: null,
      verified: false,
      required: true,
    },
    styleSuggestion: {
      label: "推荐风格",
      maxLength: null,
      verified: true,
      required: true,
      allowedValues: ["通用", "像素画", "言情漫画", "细腻厚涂"],
    },
  },
  open_story: {
    enabled: false,
    storyPrompt: {
      label: "开放故事",
      maxLength: 10000,
      verified: true,
      required: true,
    },
  },
});
