import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";

const REQUIRED_PATHS = [
  "src/contracts/common.js",
  "src/contracts/character.js",
  "src/contracts/project.js",
  "src/contracts/world-story.js",
  "src/contracts/platform.js",
  "src/contracts/index.js",
  "src/workflow/project-status.js",
  "src/workflow/invalidation.js",
  "src/workflow/task-runner.js",
  "src/editing/README.md",
  "src/ui/actions/project-actions.js",
  "src/ui/actions/generation-actions.js",
  "src/ui/actions/evaluation-actions.js",
  "docs/parallel/API_CONTRACTS.md",
  "docs/parallel/MODULE_OWNERSHIP.md",
  "docs/parallel/INTEGRATION_ORDER.md",
  "docs/handoffs/TEMPLATE.md",
];

export async function runFoundationArchitectureSmoke() {
  await Promise.all(REQUIRED_PATHS.map((path) => access(path)));

  const [legacyContracts, directContracts] = await Promise.all([
    import("../../src/contracts.js"),
    import("../../src/contracts/index.js"),
  ]);
  for (const exportName of [
    "assertCharacterProject",
    "assertCreativeSeed",
    "assertWorldBible",
    "assertStoryDraft",
    "assertGenerationRecord",
    "assertProjectDocument",
  ]) {
    assert.equal(typeof legacyContracts[exportName], "function", `兼容 barrel 缺少 ${exportName}`);
    assert.equal(typeof directContracts[exportName], "function", `新契约入口缺少 ${exportName}`);
  }

  const barrelSource = (await readFile("src/contracts.js", "utf8")).trim();
  assert.equal(barrelSource, 'export * from "./contracts/index.js";', "src/contracts.js 只能作为兼容 barrel");

  const screenFiles = (await readdir("src/ui/screens"))
    .filter((name) => name.endsWith("-screen.js"));
  assert.ok(screenFiles.length > 0 && screenFiles.length <= 5, "屏幕渲染模块必须为 1—5 个");

  const appSource = await readFile("src/app.js", "utf8");
  assert.match(appSource, /ui\/actions\/project-actions\.js/);
  assert.match(appSource, /ui\/actions\/generation-actions\.js/);
  assert.match(appSource, /ui\/actions\/evaluation-actions\.js/);
  assert.doesNotMatch(appSource, /from "\.\/storage\//, "app.js 不应直接调用 storage 实现");
  assert.doesNotMatch(appSource, /from "\.\/generation\//, "app.js 不应直接调用 generation 实现");
  assert.doesNotMatch(appSource, /from "\.\/evaluation\//, "app.js 不应直接调用 evaluation 实现");
}
