import { linesToArray } from "./dom.js";

export function readCreativeBrief(form, prefix = "") {
  const data = new FormData(form);
  const field = (name) => `${prefix}${name}`;

  return {
    platform: "maoxiang",
    outputMode: String(data.get(field("outputMode")) || "free_character"),
    characterGender: String(data.get(field("characterGender")) || "").trim(),
    ageRange: String(data.get(field("ageRange")) || "").trim(),
    worldSetting: String(data.get(field("worldSetting")) || "").trim(),
    characterIdentity: String(data.get(field("characterIdentity")) || "").trim(),
    coreExperiences: linesToArray(data.get(field("coreExperiences"))),
    relationshipType: String(data.get(field("relationshipType")) || "").trim(),
    coreConflict: String(data.get(field("coreConflict")) || "").trim(),
    personalityContradiction: String(
      data.get(field("personalityContradiction")) || "",
    ).trim(),
    initiativeLevel: String(data.get(field("initiativeLevel")) || "medium"),
    interactionTone: linesToArray(data.get(field("interactionTone"))),
    boundaries: linesToArray(data.get(field("boundaries"))),
    bannedBehaviors: linesToArray(data.get(field("bannedBehaviors"))),
    extraNotes: String(data.get(field("extraNotes")) || "").trim(),
  };
}

export function assertBriefRequirements(brief) {
  const requiredStrings = [
    ["characterGender", "请填写角色性别。"],
    ["worldSetting", "请填写世界设定。"],
    ["characterIdentity", "请填写角色身份。"],
    ["relationshipType", "请填写关系类型。"],
    ["coreConflict", "请填写核心冲突。"],
    ["initiativeLevel", "请选择主动程度。"],
  ];

  for (const [field, message] of requiredStrings) {
    if (!brief[field]?.trim()) {
      throw new Error(message);
    }
  }
  if (brief.coreExperiences.length < 1) {
    throw new Error("核心经历至少填写一项。");
  }
}

export function readQuickInput(form) {
  const data = new FormData(form);
  const quickInput = {
    idea: String(data.get("idea") || "").trim(),
    mustInclude: String(data.get("mustInclude") || "").trim(),
    avoid: String(data.get("avoid") || "").trim(),
  };
  if (!quickInput.idea) {
    throw new Error("请先写下一句话灵感。");
  }
  return quickInput;
}

function advancedBriefHasContent(brief) {
  return [
    brief.characterGender,
    brief.ageRange,
    brief.worldSetting,
    brief.characterIdentity,
    brief.relationshipType,
    brief.coreConflict,
    brief.personalityContradiction,
    brief.extraNotes,
    ...brief.coreExperiences,
    ...brief.interactionTone,
    ...brief.boundaries,
    ...brief.bannedBehaviors,
  ].some((value) => String(value || "").trim().length > 0);
}

export function composeCreativeSeed(quickInput, advancedBrief = null) {
  const sections = [quickInput.idea.trim()];
  const mustInclude = linesToArray(quickInput.mustInclude);
  const avoid = linesToArray(quickInput.avoid);

  if (mustInclude.length > 0) {
    sections.push(`必须出现：\n${mustInclude.map((item) => `- ${item}`).join("\n")}`);
  }
  if (avoid.length > 0) {
    sections.push(`不要出现：\n${avoid.map((item) => `- ${item}`).join("\n")}`);
  }
  if (advancedBrief && advancedBriefHasContent(advancedBrief)) {
    sections.push(`高级创作约束 JSON：\n${JSON.stringify(advancedBrief)}`);
  }

  return { text: sections.join("\n\n") };
}

export function createProjectTitle(idea, kind) {
  const normalized = String(idea || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return kind === "story" ? "未命名开放故事" : "未命名角色";
  }
  const characters = Array.from(normalized);
  return characters.length > 24
    ? `${characters.slice(0, 24).join("")}…`
    : normalized;
}

export function readQuestionAnswers(form, questions) {
  const data = new FormData(form);
  const answers = {};
  for (const question of questions.slice(0, 3)) {
    const shortAnswer = String(data.get(`question-text-${question.id}`) || "").trim();
    const selected = String(data.get(`question-${question.id}`) || "").trim();
    const answer = shortAnswer || selected;
    if (answer) answers[question.id] = answer;
  }
  return answers;
}
