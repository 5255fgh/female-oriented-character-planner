import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";

import { createAutosaveService } from "../../src/storage/autosave.js";
import { createProject } from "./fixtures.mjs";

test("自动保存按最后一次 schedule 做 800ms 防抖", async () => {
  const saved = [];
  const service = createAutosaveService({
    delay: 800,
    eventTarget: null,
    save: async (project) => saved.push(project),
  });

  service.schedule(createProject({ title: "第一稿" }));
  await wait(50);
  service.schedule(createProject({ title: "最后稿" }));
  await wait(825);
  await service.flush();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].title, "最后稿");
});

test("flush 立即保存最后版本并报告状态", async () => {
  const saved = [];
  const statuses = [];
  const service = createAutosaveService({
    delay: 1000,
    eventTarget: null,
    save: async (project) => saved.push(project),
    onStatus: (event) => statuses.push(event.status),
  });

  service.schedule(createProject({ title: "旧值" }));
  service.schedule(createProject({ title: "最终值" }));
  await service.flush();

  assert.deepEqual(saved.map((project) => project.title), ["最终值"]);
  assert.deepEqual(statuses, ["pending", "pending", "saving", "saved"]);
});

test("同一项目写入严格串行，较旧保存不会覆盖新值", async () => {
  let releaseFirst;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => {
    markFirstStarted = resolve;
  });
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const starts = [];
  let active = 0;
  let maximumActive = 0;

  const service = createAutosaveService({
    delay: 1000,
    eventTarget: null,
    save: async (project) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      starts.push(project.title);
      if (project.title === "先保存") {
        markFirstStarted();
        await firstGate;
      }
      active -= 1;
    },
  });

  service.schedule(createProject({ title: "先保存" }));
  const firstFlush = service.flush();
  await firstStarted;

  service.schedule(createProject({ title: "后保存" }));
  const secondFlush = service.flush();
  await Promise.resolve();
  assert.deepEqual(starts, ["先保存"]);

  releaseFirst();
  await Promise.all([firstFlush, secondFlush]);
  assert.equal(maximumActive, 1);
  assert.deepEqual(starts, ["先保存", "后保存"]);
});

test("cancel 丢弃尚未提交的自动保存", async () => {
  const saved = [];
  const service = createAutosaveService({
    delay: 1000,
    eventTarget: null,
    save: async (project) => saved.push(project),
  });

  service.schedule(createProject());
  service.cancel();
  await service.flush();

  assert.deepEqual(saved, []);
});

test("页面卸载事件会尽可能 flush 待保存项目", async () => {
  const eventTarget = new EventTarget();
  let markSaved;
  const saved = new Promise((resolve) => {
    markSaved = resolve;
  });
  const service = createAutosaveService({
    delay: 1000,
    eventTarget,
    save: async (project) => markSaved(project),
  });

  service.schedule(createProject({ title: "卸载前最后稿" }));
  eventTarget.dispatchEvent(new Event("pagehide"));

  assert.equal((await saved).title, "卸载前最后稿");
  await service.flush();
});
