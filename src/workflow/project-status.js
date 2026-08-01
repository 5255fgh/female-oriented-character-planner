export const PROJECT_STEP_IDS = Object.freeze([
  "seed",
  "brief",
  "character",
  "world",
  "story",
  "evaluation",
  "output",
]);

/**
 * 只根据项目内容推导完成状态和可访问步骤，不读取或修改 UI 状态。
 *
 * @param {Partial<import("../contracts/project.js").ProjectDocument>} project
 * @returns {{completed: Record<string, boolean>, accessibleSteps: string[]}}
 */
export function deriveProjectStatus(project) {
  const concepts = Array.isArray(project?.concepts) ? project.concepts : [];
  const platformPacks = Array.isArray(project?.platformPacks)
    ? project.platformPacks
    : [];
  const hasSeed = Boolean(project?.seed);
  const hasBrief = Boolean(project?.brief);
  const hasCharacter = Boolean(project?.character);
  const hasWorld = Boolean(project?.worldBible);
  const hasStory = Boolean(project?.storyDraft);
  const hasAnyEvaluation = Boolean(project?.ruleReport || project?.simulationReport);
  const hasEvaluation = Boolean(project?.ruleReport && project?.simulationReport);
  const hasOutput = platformPacks.length > 0;

  const completed = {
    seed: hasSeed,
    brief: hasBrief,
    character: hasCharacter,
    world: hasWorld,
    story: hasStory,
    evaluation: hasEvaluation,
    output: hasOutput,
  };

  const accessible = new Set(["seed"]);
  if (hasSeed || hasBrief || concepts.length > 0 || hasCharacter || hasWorld || hasStory) {
    accessible.add("brief");
  }
  if (hasBrief || concepts.length > 0 || hasCharacter) {
    accessible.add("character");
  }
  if (hasSeed || hasBrief || hasCharacter || hasWorld) {
    accessible.add("world");
  }
  if (hasCharacter || hasWorld || hasStory) {
    accessible.add("story");
  }
  if (hasCharacter || hasStory || hasAnyEvaluation) {
    accessible.add("evaluation");
  }
  if (hasCharacter || hasStory || hasOutput) {
    accessible.add("output");
  }

  return {
    completed,
    accessibleSteps: PROJECT_STEP_IDS.filter((step) => accessible.has(step)),
  };
}

/**
 * @param {Partial<import("../contracts/project.js").ProjectDocument>} project
 * @param {string} stepId
 * @returns {boolean}
 */
export function canAccessProjectStep(project, stepId) {
  return deriveProjectStatus(project).accessibleSteps.includes(stepId);
}
