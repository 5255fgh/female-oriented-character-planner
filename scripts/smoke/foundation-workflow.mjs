import assert from "node:assert/strict";

import { invalidateProject } from "../../src/workflow/invalidation.js";
import { deriveProjectStatus } from "../../src/workflow/project-status.js";
import { createTaskRunner } from "../../src/workflow/task-runner.js";

export async function runFoundationWorkflowSmoke() {
  const status = deriveProjectStatus({
    seed: { text: "一句话灵感" },
    concepts: [],
    platformPacks: [],
  });
  assert.deepEqual(status.accessibleSteps, ["seed", "brief", "world"]);
  assert.equal(status.completed.seed, true);
  assert.equal(status.completed.character, false);

  const project = {
    seed: { text: "一句话灵感" },
    brief: { retained: true },
    concepts: [{ id: "concept" }],
    selectedConceptId: "concept",
    character: { retained: true },
    worldBible: { retained: true },
    storyDraft: { stale: true },
    ruleReport: { stale: true },
    simulationReport: { stale: true },
    platformPacks: [{ stale: true }],
    generationRecords: [{ retained: true }],
  };
  const invalidated = invalidateProject(project, "character");
  assert.notStrictEqual(invalidated, project, "失效工具必须返回独立副本");
  assert.deepEqual(project.storyDraft, { stale: true }, "失效工具不得修改输入项目");
  assert.equal(invalidated.storyDraft, null);
  assert.deepEqual(invalidated.ruleReport, { stale: true });
  assert.deepEqual(invalidated.simulationReport, { stale: true });
  assert.deepEqual(invalidated.platformPacks, [{ stale: true }]);
  assert.deepEqual(invalidated.worldBible, { retained: true });
  assert.deepEqual(invalidated.generationRecords, [{ retained: true }]);

  const runner = createTaskRunner();
  let finish;
  const first = runner.run("same-task", () => new Promise((resolve) => {
    finish = resolve;
  }));
  await assert.rejects(
    runner.run("same-task", () => "duplicate"),
    /already running/,
    "同名任务不得重复提交",
  );
  finish("done");
  assert.equal(await first, "done");
  assert.equal(runner.isRunning("same-task"), false);

  const cancelled = runner.run("cancel-task", ({ signal }) =>
    new Promise((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", resolve, { once: true });
    })
  );
  assert.equal(runner.cancel("cancel-task"), true);
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(runner.isRunning("cancel-task"), false);
}
