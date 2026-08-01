export function canCopyPlatformBlock(state, block) {
  const hasBlockingRuleError =
    state.projectKind === "character" &&
    state.project.ruleReport?.status === "fail";
  return Boolean(block?.valid) && !hasBlockingRuleError;
}

export function canCopyPlatformPack(state, pack) {
  return Boolean(
    pack &&
    pack.blocks.every((block) => canCopyPlatformBlock(state, block)),
  );
}
