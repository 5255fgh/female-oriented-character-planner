import test from "node:test";

import { runCoreFlowSmoke } from "../../scripts/smoke/core-flow.mjs";

test("核心 Mock 流程从 seed 贯通到保存、导出与导入", async () => {
  await runCoreFlowSmoke();
});
