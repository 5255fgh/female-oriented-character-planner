import { assertCharacterProject, createId } from "../contracts.js";
import { deepClone } from "./clone.js";
import { getProject, saveProject } from "./repository.js";

const NOT_GENERATED = "未生成";

function displayValue(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return NOT_GENERATED;
  }
  return value.trim().replace(/\r?\n/g, " / ");
}

function displayList(value, emptyValue = NOT_GENERATED) {
  if (!Array.isArray(value) || value.length === 0) {
    return emptyValue;
  }
  return value.map((item) => displayValue(item)).join("、");
}

function addFields(lines, entries) {
  for (const [label, value] of entries) {
    lines.push(`- ${label}：${displayValue(value)}`);
  }
}

async function requireProject(projectId) {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error("项目不存在");
  }
  assertCharacterProject(project);
  return project;
}

export async function exportProjectJson(projectId) {
  const project = await requireProject(projectId);
  return JSON.stringify(project, null, 2);
}

export async function exportProjectMarkdown(projectId) {
  const project = await requireProject(projectId);
  const lines = [`# ${displayValue(project.title)}`, "", "## 创作简报", ""];

  addFields(lines, [
    ["平台", project.brief?.platform],
    ["输出模式", project.brief?.outputMode],
    ["角色性别", project.brief?.characterGender],
    ["年龄范围", project.brief?.ageRange],
    ["世界设定", project.brief?.worldSetting],
    ["角色身份", project.brief?.characterIdentity],
    ["核心经历", displayList(project.brief?.coreExperiences)],
    ["关系类型", project.brief?.relationshipType],
    ["核心冲突", project.brief?.coreConflict],
    ["性格矛盾", project.brief?.personalityContradiction],
    ["主动程度", project.brief?.initiativeLevel],
    ["互动基调", displayList(project.brief?.interactionTone)],
    ["边界", displayList(project.brief?.boundaries)],
    ["禁用行为", displayList(project.brief?.bannedBehaviors)],
    ["补充说明", project.brief?.extraNotes],
  ]);

  lines.push("", "## 选中候选", "");
  const selectedConcept = project.concepts?.find(
    (concept) => concept.id === project.selectedConceptId,
  );
  if (!selectedConcept) {
    lines.push(NOT_GENERATED);
  } else {
    addFields(lines, [
      ["名称", selectedConcept.name],
      ["一句话概念", selectedConcept.oneLiner],
      ["核心经历", selectedConcept.coreExperience],
      ["初始关系", selectedConcept.initialRelation],
      ["核心冲突", selectedConcept.coreConflict],
      ["独特行为", selectedConcept.uniqueBehavior],
      ["首次互动", selectedConcept.firstInteraction],
      ["长期潜力", selectedConcept.longTermPotential],
      ["差异说明", selectedConcept.differenceSummary],
    ]);
  }

  lines.push("", "## 公开信息", "");
  addFields(lines, [
    ["名称", project.character?.publicInfo?.name],
    ["一句话介绍", project.character?.publicInfo?.oneLiner],
    ["外貌", project.character?.publicInfo?.appearance],
    ["标签", displayList(project.character?.publicInfo?.tags)],
  ]);

  lines.push("", "## 内部人设", "");
  addFields(lines, [
    ["身份", project.character?.persona?.identity],
    ["背景", project.character?.persona?.background],
    ["当前目标", project.character?.persona?.currentGoal],
    ["秘密", project.character?.persona?.secret],
    ["欲望", project.character?.persona?.desire],
    ["恐惧", project.character?.persona?.fear],
    ["内在矛盾", project.character?.persona?.contradiction],
    ["具体行为", displayList(project.character?.persona?.concreteBehaviors)],
    ["主动规则", displayList(project.character?.persona?.initiativeRules)],
    ["禁止行为", displayList(project.character?.persona?.forbiddenBehaviors)],
  ]);

  lines.push("", "## 关系推进", "");
  addFields(lines, [
    ["初始关系", project.character?.relationship?.initialRelation],
    ["吸引条件", displayList(project.character?.relationship?.attractionConditions)],
    ["冲突模式", project.character?.relationship?.conflictPattern],
    ["修复模式", project.character?.relationship?.repairPattern],
  ]);
  lines.push("", "### 关系阶段", "");
  const stages = project.character?.relationship?.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    lines.push(NOT_GENERATED);
  } else {
    stages.forEach((stage, index) => {
      lines.push(
        `#### 阶段 ${index + 1}：${displayValue(stage?.name)}`,
        "",
        `- 触发条件：${displayValue(stage?.trigger)}`,
        `- 行为表现：${displayValue(stage?.behavior)}`,
        "",
      );
    });
    lines.pop();
  }

  lines.push("", "## 对话风格", "");
  addFields(lines, [
    ["称呼方式", project.character?.dialogueStyle?.addressStyle],
    ["句式", project.character?.dialogueStyle?.sentenceStyle],
    ["回复长度", project.character?.dialogueStyle?.replyLength],
    ["动作叙述", project.character?.dialogueStyle?.actionNarration],
    ["情绪表达", project.character?.dialogueStyle?.emotionalExpression],
    ["禁用短语", displayList(project.character?.dialogueStyle?.bannedPhrases)],
  ]);
  lines.push("", "### 对话示例", "");
  const examples = project.character?.dialogueStyle?.examples;
  if (!Array.isArray(examples) || examples.length === 0) {
    lines.push(NOT_GENERATED);
  } else {
    examples.forEach((example, index) => {
      lines.push(
        `#### 示例 ${index + 1}`,
        "",
        `- 用户：${displayValue(example?.user)}`,
        `- 角色：${displayValue(example?.character)}`,
        "",
      );
    });
    lines.pop();
  }

  lines.push(
    "",
    "## 三种开场",
    "",
    "### 剧情开场",
    "",
    displayValue(project.character?.openings?.plotOpening),
    "",
    "### 日常开场",
    "",
    displayValue(project.character?.openings?.dailyOpening),
    "",
    "### 张力开场",
    "",
    displayValue(project.character?.openings?.tensionOpening),
  );

  lines.push("", "## 形象提示词", "");
  addFields(lines, [
    ["外貌提示词", project.character?.imageDesign?.appearancePrompt],
    ["风格建议", project.character?.imageDesign?.styleSuggestion],
  ]);

  lines.push("", "## 最近规则检查摘要", "");
  if (!project.ruleReport) {
    lines.push(NOT_GENERATED);
  } else {
    lines.push(`- 状态：${displayValue(project.ruleReport.status)}`);
    if (!Array.isArray(project.ruleReport.issues) || project.ruleReport.issues.length === 0) {
      lines.push("- 问题：无");
    } else {
      project.ruleReport.issues.forEach((issue, index) => {
        lines.push(
          "",
          `### 检查项 ${index + 1}：${displayValue(issue?.code)}`,
          "",
          `- 严重程度：${displayValue(issue?.severity)}`,
          `- 字段：${displayValue(issue?.fieldPath)}`,
          `- 问题：${displayValue(issue?.message)}`,
          `- 证据：${displayValue(issue?.evidence)}`,
          `- 建议：${displayValue(issue?.suggestedAction)}`,
        );
      });
    }
  }

  lines.push("", "## 最近模拟测试摘要", "");
  if (!project.simulationReport) {
    lines.push(NOT_GENERATED);
  } else {
    const scenarios = Array.isArray(project.simulationReport.scenarios)
      ? project.simulationReport.scenarios
      : [];
    const issueCount = scenarios.reduce(
      (total, scenario) =>
        total + (Array.isArray(scenario?.issues) ? scenario.issues.length : 0),
      0,
    );
    lines.push(
      `- 状态：${displayValue(project.simulationReport.status)}`,
      `- 摘要：${displayValue(project.simulationReport.summary)}`,
      `- 场景数：${scenarios.length || NOT_GENERATED}`,
      `- 检出问题数：${issueCount}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function importProjectJson(fileContent) {
  if (typeof fileContent !== "string") {
    throw new Error("项目 JSON 内容必须是字符串");
  }

  let parsed;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error("项目 JSON 解析失败");
  }

  assertCharacterProject(parsed);
  const timestamp = new Date().toISOString();
  const imported = {
    ...deepClone(parsed),
    id: createId("project"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  assertCharacterProject(imported);
  return saveProject(imported);
}
