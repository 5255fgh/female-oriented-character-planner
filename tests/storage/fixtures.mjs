export const ISO_A = "2026-08-01T00:00:00.000Z";

export function createBrief() {
  return {
    platform: "maoxiang",
    outputMode: "free_character",
    characterGender: "男",
    ageRange: "25—30",
    worldSetting: "现代都市",
    characterIdentity: "调查记者",
    coreExperiences: ["追查旧案"],
    relationshipType: "久别重逢",
    coreConflict: "真相与信任冲突",
    personalityContradiction: "冷静但护短",
    initiativeLevel: "high",
    interactionTone: ["克制", "温柔"],
    boundaries: ["尊重拒绝"],
    bannedBehaviors: ["替用户做决定"],
    extraNotes: "保持现实感",
  };
}

export function createConcepts() {
  return [0, 1, 2].map((index) => ({
    id: `concept-${index + 1}`,
    name: `方向${index + 1}`,
    oneLiner: `一句话${index + 1}`,
    coreExperience: `经历${index + 1}`,
    initialRelation: `关系${index + 1}`,
    coreConflict: `冲突${index + 1}`,
    uniqueBehavior: `行为${index + 1}`,
    firstInteraction: `互动${index + 1}`,
    longTermPotential: `潜力${index + 1}`,
    differenceSummary: `差异${index + 1}`,
  }));
}

export function createCharacter() {
  return {
    meta: {
      id: "character-1",
      name: "沈砚",
      createdAt: ISO_A,
      updatedAt: ISO_A,
    },
    publicInfo: {
      name: "沈砚",
      oneLiner: "沉默地追查真相",
      appearance: "黑发灰眸",
      tags: ["克制", "主动"],
    },
    persona: {
      identity: "调查记者",
      background: "曾因旧案离开故乡",
      currentGoal: "查清真相",
      secret: "掌握关键录音",
      desire: "重新获得信任",
      fear: "再次失去重要的人",
      contradiction: "理性与保护欲冲突",
      concreteBehaviors: ["记录细节"],
      initiativeRules: ["主动推进调查"],
      forbiddenBehaviors: ["越过明确边界"],
    },
    relationship: {
      initialRelation: "久别重逢",
      attractionConditions: ["坦诚"],
      stages: [{ name: "重逢", trigger: "共同调查", behavior: "谨慎试探" }],
      conflictPattern: "隐瞒引发误解",
      repairPattern: "给出证据并道歉",
    },
    dialogueStyle: {
      addressStyle: "直呼姓名",
      sentenceStyle: "短句",
      replyLength: "中等",
      actionNarration: "克制",
      emotionalExpression: "通过细节表达",
      bannedPhrases: ["你必须"],
      examples: [{ user: "你还好吗？", character: "先坐下，我慢慢说。" }],
    },
    openings: {
      plotOpening: "雨夜里，他带着旧档案出现。",
      dailyOpening: "咖啡店门铃响起。",
      tensionOpening: "录音在沉默中播放。",
    },
    imageDesign: {
      appearancePrompt: "黑发灰眸的年轻记者",
      styleSuggestion: "通用",
    },
  };
}

export function createStory() {
  return {
    title: "雨夜旧案",
    oneLiner: "两人共同追查被掩埋的真相",
    userIdentity: "旧案证人的女儿",
    mainCharacters: ["沈砚", "用户"],
    premise: "一段录音重新打开旧案",
    coreConflict: "公开真相可能伤害无辜者",
    initialScene: "雨夜车站",
    openingLine: "这次，我不会再瞒你。",
    keyNodes: Array.from({ length: 8 }, (_, index) => `节点${index + 1}`),
    branches: ["公开证据", "继续调查"],
    foreshadowing: ["损坏的录音带"],
    stateVariables: ["trust"],
  };
}

export function createRuleReport() {
  return { status: "pass", issues: [] };
}

export function createSimulationReport() {
  return {
    status: "pass",
    scenarios: Array.from({ length: 8 }, (_, index) => ({
      scenarioId: `scenario-${index + 1}`,
      userInput: `输入${index + 1}`,
      characterResponse: `回复${index + 1}`,
      issues: [],
      evidence: [],
      suggestedFields: [],
    })),
    summary: "行为稳定",
  };
}

export function createProject(overrides = {}) {
  return {
    id: "project-1",
    title: "阶段项目",
    seed: null,
    brief: null,
    concepts: [],
    selectedConceptId: null,
    character: null,
    worldBible: null,
    storyDraft: null,
    ruleReport: null,
    simulationReport: null,
    platformPacks: [],
    generationRecords: [],
    createdAt: ISO_A,
    updatedAt: ISO_A,
    ...structuredClone(overrides),
  };
}

export function createLegacyCharacterProject(overrides = {}) {
  const concepts = createConcepts();
  return {
    id: "legacy-project",
    title: "旧版完整项目",
    brief: createBrief(),
    concepts,
    selectedConceptId: concepts[0].id,
    character: createCharacter(),
    ruleReport: createRuleReport(),
    simulationReport: createSimulationReport(),
    platformPacks: [],
    createdAt: ISO_A,
    updatedAt: ISO_A,
    ...structuredClone(overrides),
  };
}
