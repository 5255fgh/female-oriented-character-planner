import { linesToArray } from "./dom.js";

export function readCreativeBrief(form) {
  const data = new FormData(form);

  return {
    platform: "maoxiang",
    outputMode: String(data.get("outputMode") || "free_character"),
    characterGender: String(data.get("characterGender") || "").trim(),
    ageRange: String(data.get("ageRange") || "").trim(),
    worldSetting: String(data.get("worldSetting") || "").trim(),
    characterIdentity: String(data.get("characterIdentity") || "").trim(),
    coreExperiences: linesToArray(data.get("coreExperiences")),
    relationshipType: String(data.get("relationshipType") || "").trim(),
    coreConflict: String(data.get("coreConflict") || "").trim(),
    personalityContradiction: String(
      data.get("personalityContradiction") || "",
    ).trim(),
    initiativeLevel: String(data.get("initiativeLevel") || "medium"),
    interactionTone: linesToArray(data.get("interactionTone")),
    boundaries: linesToArray(data.get("boundaries")),
    bannedBehaviors: linesToArray(data.get("bannedBehaviors")),
    extraNotes: String(data.get("extraNotes") || "").trim(),
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
    throw new Error("核心经历至少填写一项。" );
  }
}
