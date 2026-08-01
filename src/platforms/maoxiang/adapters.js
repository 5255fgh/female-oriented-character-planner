import { MAOXIANG_ADAPTER_FLOW_IDS } from "./rules.js";

/** @param {unknown[]} values */
function compactText(values) {
  return values
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => /** @type {string} */ (value).trim());
}

/** @param {string[]} values */
function formatList(values) {
  return compactText(values).map((value, index) => `${index + 1}. ${value}`).join("\n");
}

/** @param {Array<[string, string]>} sections */
function formatSections(sections) {
  return sections
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([label, value]) => `${label}：${value.trim()}`)
    .join("\n");
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function requireCharacter(project) {
  if (!project.character) {
    throw new Error("project.character: required for this maoxiang flow");
  }
  return project.character;
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function requireStory(project) {
  if (!project.storyDraft) {
    throw new Error("project.storyDraft: required for editor_open_story");
  }
  return project.storyDraft;
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function adaptEditorCharacter(project) {
  const character = requireCharacter(project);
  const { publicInfo, persona, relationship, dialogueStyle, openings, imageDesign } = character;
  const world = project.worldBible;

  return {
    roleName: publicInfo.name || character.meta.name,
    roleIntroduction: formatSections([
      ["一句话简介", publicInfo.oneLiner],
      ["外观", publicInfo.appearance],
      ["标签", publicInfo.tags.join("、")],
    ]),
    roleSetting: formatSections([
      ["身份", persona.identity],
      ["背景", persona.background],
      ["当前目标", persona.currentGoal],
      ["秘密", persona.secret],
      ["欲望", persona.desire],
      ["恐惧", persona.fear],
      ["矛盾", persona.contradiction],
      ["初始关系", relationship.initialRelation],
      ["冲突模式", relationship.conflictPattern],
      ["修复模式", relationship.repairPattern],
      ["主动规则", persona.initiativeRules.join("；")],
      ["禁止行为", persona.forbiddenBehaviors.join("；")],
    ]),
    sceneSetting: formatSections([
      ["世界概述", world?.summary || ""],
      ["重要地点", world?.locations.join("、") || ""],
      ["剧情开场", openings.plotOpening],
      ["日常开场", openings.dailyOpening],
      ["张力开场", openings.tensionOpening],
    ]),
    openingMessage:
      openings.plotOpening || openings.dailyOpening || openings.tensionOpening,
    dialogueExamples: dialogueStyle.examples
      .map(
        (example, index) =>
          `示例 ${index + 1}\n用户：${example.user}\n${publicInfo.name || "角色"}：${example.character}`,
      )
      .join("\n\n"),
    imagePrompt: imageDesign.appearancePrompt,
    voiceSuggestion: formatSections([
      ["称呼", dialogueStyle.addressStyle],
      ["句式", dialogueStyle.sentenceStyle],
      ["回复长度", dialogueStyle.replyLength],
      ["动作叙述", dialogueStyle.actionNarration],
      ["情绪表达", dialogueStyle.emotionalExpression],
      ["禁用表达", dialogueStyle.bannedPhrases.join("、")],
    ]),
  };
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function adaptFreeCharacter(project) {
  const character = requireCharacter(project);
  const editorFields = adaptEditorCharacter(project);
  return {
    characterPrompt: [
      editorFields.roleName,
      editorFields.roleIntroduction,
      editorFields.roleSetting,
      editorFields.sceneSetting,
      editorFields.voiceSuggestion,
      editorFields.dialogueExamples,
    ]
      .filter((value) => value.trim().length > 0)
      .join("\n\n"),
  };
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function adaptDeadRival(project) {
  const character = requireCharacter(project);
  const { publicInfo, persona, relationship, dialogueStyle } = character;
  return {
    rivalSetting: formatSections([
      ["姓名", publicInfo.name || character.meta.name],
      ["定位", publicInfo.oneLiner],
      ["身份", persona.identity],
      ["当前目标", persona.currentGoal],
      ["核心矛盾", persona.contradiction],
      ["与你的关系", relationship.initialRelation],
    ]),
    history: formatSections([
      ["背景", persona.background],
      ["秘密", persona.secret],
      ["关系阶段", relationship.stages.map((stage) => `${stage.name}：${stage.trigger}；${stage.behavior}`).join("\n")],
      ["冲突模式", relationship.conflictPattern],
      ["修复模式", relationship.repairPattern],
    ]),
    other: formatSections([
      ["具体行为", persona.concreteBehaviors.join("；")],
      ["表达方式", dialogueStyle.emotionalExpression],
      ["禁止行为", persona.forbiddenBehaviors.join("；")],
    ]),
  };
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function adaptImageShape(project) {
  const character = requireCharacter(project);
  return {
    imagePrompt: character.imageDesign.appearancePrompt,
    styleSuggestion: character.imageDesign.styleSuggestion,
  };
}

/** @param {import("../../contracts.js").ProjectDocument} project */
function adaptEditorOpenStory(project) {
  const story = requireStory(project);
  const world = project.worldBible;
  const keyNodeOutline = formatList(story.keyNodes);
  const branches = formatList(story.branches);
  const foreshadowing = formatList(story.foreshadowing);

  return {
    storyTitle: story.title,
    mainCharacters: formatList(story.mainCharacters),
    storyFoundation: formatSections([
      ["一句话卖点", story.oneLiner],
      ["用户身份", story.userIdentity],
      ["故事前提", story.premise],
      ["核心冲突", story.coreConflict],
      ["世界概述", world?.summary || ""],
      ["世界规则", world?.rules.join("；") || ""],
      ["既定事实", world?.canonFacts.join("；") || ""],
    ]),
    storyContent: formatSections([
      ["初始场景", story.initialScene],
      ["关键节点", keyNodeOutline],
      ["开放分支", branches],
      ["伏笔", foreshadowing],
    ]),
    openingMessage: story.openingLine,
    chapterOutline: keyNodeOutline,
    storyPrompt: formatSections([
      ["创作目标", "保持开放互动，以 8 个关键节点推进，不扩写几十章正文"],
      ["用户身份", story.userIdentity],
      ["核心冲突", story.coreConflict],
      ["状态说明", story.stateVariables.join("；")],
      ["禁止事实", world?.forbiddenFacts.join("；") || ""],
    ]),
  };
}

const ADAPTERS = Object.freeze({
  editor_character: adaptEditorCharacter,
  free_character: adaptFreeCharacter,
  dead_rival: adaptDeadRival,
  image_shape: adaptImageShape,
  editor_open_story: adaptEditorOpenStory,
});

/**
 * 将项目数据声明式映射为猫箱字段，不执行生成、压缩或持久化。
 *
 * @param {import("../../contracts.js").ProjectDocument} project
 * @param {string} flowId
 * @returns {Record<string, string>}
 */
export function adaptMaoxiangFields(project, flowId) {
  if (!MAOXIANG_ADAPTER_FLOW_IDS.includes(flowId)) {
    throw new Error(
      `flowId: expected one of ${MAOXIANG_ADAPTER_FLOW_IDS.join(", ")}`,
    );
  }
  return ADAPTERS[flowId](project);
}
