/**
 * 判断角色产物是否早于角色最近一次修改；旧项目没有对应记录时按可能过期处理。
 *
 * @param {import("../contracts.js").ProjectDocument} project
 * @param {string} task
 */
export function isCharacterArtifactStale(project, task) {
  if (!project?.character) return false;
  const characterUpdatedAt = Date.parse(project.character.meta.updatedAt);
  if (!Number.isFinite(characterUpdatedAt)) return true;

  const latestArtifactAt = (project.generationRecords || [])
    .filter((record) => (
      record.status === "completed" &&
      record.target === "character" &&
      record.task === task
    ))
    .reduce((latest, record) => {
      const timestamp = Date.parse(record.createdAt);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, Number.NEGATIVE_INFINITY);

  return latestArtifactAt < characterUpdatedAt;
}

export function canCopyPlatformBlock(state, block) {
  const hasBlockingRuleError =
    state.projectKind === "character" &&
    state.project.ruleReport?.status === "fail" &&
    !isCharacterArtifactStale(state.project, "quick-check");
  return Boolean(block?.valid) && !hasBlockingRuleError;
}

export function canCopyPlatformPack(state, pack) {
  return Boolean(
    pack &&
    pack.blocks.every((block) => canCopyPlatformBlock(state, block)),
  );
}
