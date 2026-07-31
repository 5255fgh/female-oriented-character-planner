import assert from "node:assert/strict";
import { createServer } from "vite";

const IMAGE_STYLES = ["通用", "像素画", "言情漫画", "细腻厚涂"];

async function runContractAndMockSmoke() {
  const contracts = await import("../src/contracts.js");
  const { createMockLLMClient } = await import(
    "../src/mock/mock-llm-client.js"
  );

  assert.equal(
    typeof contracts.assertConceptCandidates,
    "function",
    "contracts.js 应可导入",
  );
  assert.equal(
    typeof contracts.applyFieldPatch,
    "function",
    "contracts.js 应导出 applyFieldPatch",
  );

  const client = createMockLLMClient();
  assert.equal(typeof client.completeJson, "function", "mock client 应可创建");
  assert.equal(typeof client.completeText, "function", "mock client 应实现 completeText");

  const concepts = await client.completeJson({
    task: "concept-generation",
    messages: [],
  });
  contracts.assertConceptCandidates(concepts);
  assert.equal(concepts.length, 3, "mock 概念必须正好返回 3 个");

  const character = await client.completeJson({
    task: "character-expansion",
    messages: [],
  });
  contracts.assertCharacterDraft(character);
  const characterWithCustomStyle = structuredClone(character);
  characterWithCustomStyle.imageDesign.styleSuggestion = "水彩";
  assert.doesNotThrow(
    () => contracts.assertCharacterDraft(characterWithCustomStyle),
    "角色草稿中的画风建议应允许任意字符串",
  );

  const fieldPatch = await client.completeJson({
    task: "field-regeneration",
    messages: [],
  });
  contracts.assertFieldPatch(fieldPatch);

  const simulation = await client.completeJson({
    task: "dialogue-evaluation",
    messages: [],
  });
  contracts.assertSimulationReport(simulation);
  assert.equal(
    simulation.scenarios.length,
    8,
    "mock 模拟测试必须正好返回 8 个场景",
  );

  const freeCharacterPack = await client.completeJson({
    task: "maoxiang-free-character",
    messages: [],
  });
  contracts.assertPlatformPack(freeCharacterPack);
  const characterPrompt = freeCharacterPack.blocks.find(
    (block) => block.id === "characterPrompt",
  );
  assert.ok(characterPrompt, "自由创建包必须包含 characterPrompt");
  assert.ok(
    contracts.countUnicodeCharacters(characterPrompt.text) <= 1000,
    "characterPrompt 不得超过 1000 字",
  );
  const inconsistentPack = structuredClone(freeCharacterPack);
  inconsistentPack.blocks[0].text = "字".repeat(1001);
  inconsistentPack.blocks[0].currentLength = 1001;
  assert.throws(
    () => contracts.assertPlatformPack(inconsistentPack),
    /PlatformPack\.blocks\[0\]\.valid/,
    "超长文本不能继续标记为有效",
  );

  const unsafeFlowPack = structuredClone(freeCharacterPack);
  unsafeFlowPack.flowId = "constructor";
  assert.throws(
    () => contracts.assertPlatformPack(unsafeFlowPack),
    /PlatformPack\.flowId/,
    "flowId 只能使用已知入口且不得读取对象原型链",
  );

  const deadRivalPack = await client.completeJson({
    task: "maoxiang-dead-rival",
    messages: [],
  });
  contracts.assertPlatformPack(deadRivalPack);
  const rivalSetting = deadRivalPack.blocks.find(
    (block) => block.id === "rivalSetting",
  );
  assert.ok(rivalSetting, "亡者劲敌包必须包含 rivalSetting");
  assert.ok(
    contracts.countUnicodeCharacters(rivalSetting.text) <= 300,
    "rivalSetting 不得超过 300 字",
  );

  const imageShapePack = await client.completeJson({
    task: "maoxiang-image-shape",
    messages: [],
  });
  contracts.assertPlatformPack(imageShapePack);

  const original = {
    publicInfo: { name: "原始名称", tags: ["克制"] },
  };
  const snapshot = structuredClone(original);
  const patched = contracts.applyFieldPatch(original, {
    fieldPath: "publicInfo.name",
    value: "更新名称",
  });
  assert.deepEqual(original, snapshot, "applyFieldPatch 不得修改原对象");
  assert.notStrictEqual(patched, original, "applyFieldPatch 必须返回深拷贝");
  assert.equal(patched.publicInfo.name, "更新名称");

  assert.throws(
    () => contracts.getValueAtPath(original, "publicInfo.tags[0]"),
    /fieldPath|publicInfo\.tags\[0\]/,
    "字段路径只允许点分隔格式",
  );
}

async function runBusinessFlowSmoke() {
  const vite = await createServer({
    root: process.cwd(),
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    // 通过 Vite SSR 加载，确保业务模块中的 Markdown ?raw 导入真实可用。
    const contracts = await vite.ssrLoadModule("/src/contracts.js");
    const { createEmptyBrief } = await vite.ssrLoadModule("/src/app-state.js");
    const { createMockLLMClient } = await vite.ssrLoadModule(
      "/src/mock/mock-llm-client.js",
    );
    const { generateConcepts } = await vite.ssrLoadModule(
      "/src/generation/concept-generator.js",
    );
    const { expandCharacter } = await vite.ssrLoadModule(
      "/src/generation/character-generator.js",
    );
    const { regenerateField } = await vite.ssrLoadModule(
      "/src/generation/field-regenerator.js",
    );
    const { checkRules } = await vite.ssrLoadModule(
      "/src/evaluation/rule-checker.js",
    );
    const { runDialogueTest } = await vite.ssrLoadModule(
      "/src/evaluation/dialogue-tester.js",
    );
    const { generateMaoxiangPack } = await vite.ssrLoadModule(
      "/src/platforms/maoxiang/pack-generator.js",
    );
    const { validatePlatformPack } = await vite.ssrLoadModule(
      "/src/platforms/maoxiang/pack-validator.js",
    );

    const brief = {
      ...createEmptyBrief(),
      characterGender: "女",
      ageRange: "25-30",
      worldSetting: "现代都市",
      characterIdentity: "调查记者",
      coreExperiences: ["追查旧案"],
      relationshipType: "宿敌转盟友",
      coreConflict: "真相与信任",
      personalityContradiction: "冷静但心软",
      initiativeLevel: "high",
      interactionTone: ["克制", "有行动力"],
      boundaries: ["尊重拒绝"],
      bannedBehaviors: ["替用户决定"],
      extraNotes: "Mock 全流程验收",
    };
    contracts.assertCreativeBrief(brief);

    const client = createMockLLMClient();
    const concepts = await generateConcepts(brief, client);
    assert.equal(concepts.length, 3, "业务接口必须生成正好 3 个候选");

    const originalCharacter = await expandCharacter(concepts[0], brief, client);
    const fieldPath = "persona.background";
    const patch = await regenerateField(
      originalCharacter,
      fieldPath,
      "增加旧案细节",
      client,
    );
    assert.equal(patch.fieldPath, fieldPath, "字段重生成不得改写请求路径");
    const character = contracts.applyFieldPatch(originalCharacter, patch);
    assert.notDeepEqual(
      contracts.getValueAtPath(character, fieldPath),
      contracts.getValueAtPath(originalCharacter, fieldPath),
      "字段重生成应产生实际变化",
    );
    const revertedCharacter = contracts.applyFieldPatch(character, {
      fieldPath,
      value: contracts.getValueAtPath(originalCharacter, fieldPath),
    });
    assert.deepEqual(
      revertedCharacter,
      originalCharacter,
      "单字段重生成只能改变一个字段路径",
    );

    const ruleReport = checkRules(character);
    contracts.assertRuleCheckReport(ruleReport);

    const simulationReport = await runDialogueTest(character, client);
    contracts.assertSimulationReport(simulationReport);
    assert.equal(
      simulationReport.scenarios.length,
      8,
      "业务接口必须运行正好 8 个场景",
    );

    const freeCharacterPack = await generateMaoxiangPack(
      character,
      "free_character",
      client,
    );
    const characterPrompt = freeCharacterPack.blocks.find(
      (block) => block.id === "characterPrompt",
    );
    assert.ok(characterPrompt, "free_character 必须包含 characterPrompt");
    assert.ok(characterPrompt.currentLength <= 1000, "characterPrompt 不得超过 1000 字");

    const deadRivalPack = await generateMaoxiangPack(
      character,
      "dead_rival",
      client,
    );
    const rivalSetting = deadRivalPack.blocks.find(
      (block) => block.id === "rivalSetting",
    );
    assert.ok(rivalSetting, "dead_rival 必须包含 rivalSetting");
    assert.ok(rivalSetting.currentLength <= 300, "rivalSetting 不得超过 300 字");
    for (const blockId of ["history", "other"]) {
      assert.equal(
        deadRivalPack.blocks.find((block) => block.id === blockId)?.maxLength,
        null,
        `${blockId} 的未知上限必须保持 null`,
      );
    }

    const imageShapePack = await generateMaoxiangPack(
      character,
      "image_shape",
      client,
    );
    const imagePrompt = imageShapePack.blocks.find(
      (block) => block.id === "imagePrompt",
    );
    const styleSuggestion = imageShapePack.blocks.find(
      (block) => block.id === "styleSuggestion",
    );
    assert.equal(imagePrompt?.maxLength, null, "imagePrompt 的未知上限必须保持 null");
    assert.ok(
      IMAGE_STYLES.includes(styleSuggestion?.text),
      "styleSuggestion 必须属于四个允许值",
    );

    const overLimitText = "字".repeat(1001);
    const editedPack = validatePlatformPack({
      ...freeCharacterPack,
      blocks: freeCharacterPack.blocks.map((block) =>
        block.id === "characterPrompt"
          ? {
              ...block,
              text: overLimitText,
              currentLength: 1001,
              valid: false,
            }
          : block,
      ),
    });
    assert.equal(
      editedPack.blocks[0].text,
      overLimitText,
      "超限输入只能标记，不能 substring 截断",
    );
    assert.equal(editedPack.blocks[0].valid, false, "超限输入必须标记为无效");

    const timestamp = new Date().toISOString();
    contracts.assertCharacterProject({
      id: "project-smoke",
      title: "Mock 全流程",
      brief,
      concepts,
      selectedConceptId: concepts[0].id,
      character,
      ruleReport,
      simulationReport,
      platformPacks: [freeCharacterPack, deadRivalPack, imageShapePack],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } finally {
    await vite.close();
  }
}

async function runLLMClientSmoke() {
  const { createLLMClient } = await import(
    "../src/llm/openai-compatible-client.js"
  );
  const originalFetch = globalThis.fetch;
  const retryMessage =
    "只返回一个合法 JSON 值，不要使用 Markdown 代码围栏，不要添加解释文字。";

  function installFetchHarness(responses) {
    const harness = {
      callCount: 0,
      requestBodies: [],
    };

    globalThis.fetch = async (_url, options) => {
      if (harness.callCount >= responses.length) {
        throw new Error("LLM client 发起了未预期的额外请求");
      }

      const response = responses[harness.callCount];
      harness.callCount += 1;
      harness.requestBodies.push(JSON.parse(options.body));
      const status = response.status ?? 200;
      const payload = Object.prototype.hasOwnProperty.call(response, "payload")
        ? response.payload
        : { choices: [{ message: { content: response.content } }] };

      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: response.statusText ?? (status === 200 ? "OK" : "Error"),
        async text() {
          return Object.prototype.hasOwnProperty.call(response, "rawText")
            ? response.rawText
            : JSON.stringify(payload);
        },
      };
    };

    return harness;
  }

  function createClient() {
    return createLLMClient({
      endpoint: "https://example.invalid/chat/completions",
      model: "smoke-model",
    });
  }

  async function assertSingleRequestParse(label, content, expected) {
    const harness = installFetchHarness([{ content }]);
    const result = await createClient().completeJson({
      task: label,
      messages: [{ role: "user", content: "只返回原始 JSON" }],
    });
    assert.deepEqual(result, expected, `${label} 应解析为预期 JSON`);
    assert.equal(harness.callCount, 1, `${label} 不应触发重试`);
  }

  try {
    await assertSingleRequestParse(
      "裸 JSON",
      "\uFEFF  \n{\"ok\":true}\t",
      { ok: true },
    );
    await assertSingleRequestParse(
      "json 代码围栏",
      "```json\n{\"ok\":true}\n```",
      { ok: true },
    );
    await assertSingleRequestParse(
      "普通代码围栏",
      "```\n{\"ok\":true}\n```",
      { ok: true },
    );
    await assertSingleRequestParse(
      "JSON 前后说明",
      "说明 {不是JSON}\n{\"ok\":true}\n以上是结果。",
      { ok: true },
    );
    await assertSingleRequestParse(
      "嵌套 JSON",
      '{"outer":{"items":[1,{"ready":true}]}}',
      { outer: { items: [1, { ready: true }] } },
    );
    await assertSingleRequestParse(
      "数组 JSON",
      '[{"id":1},[2,3]]',
      [{ id: 1 }, [2, 3]],
    );
    await assertSingleRequestParse(
      "字符串中含大括号",
      '{"text":"保留 {大括号} 与 [中括号]"}',
      { text: "保留 {大括号} 与 [中括号]" },
    );
    await assertSingleRequestParse(
      "字符串中含转义引号",
      '{"text":"她说：\\\"继续前进\\\"","path":"C:\\\\temp"}',
      { text: '她说："继续前进"', path: "C:\\temp" },
    );
    await assertSingleRequestParse(
      "content 数组",
      [
        { type: "text", text: '{"ok":tr' },
        { type: "text", text: "ue}" },
      ],
      { ok: true },
    );

    const retryHarness = installFetchHarness([
      { content: "这不是 JSON" },
      { content: '{"ok":true}' },
    ]);
    const retriedResult = await createClient().completeJson({
      task: "retry-once",
      messages: [{ role: "user", content: "返回 JSON" }],
    });
    assert.deepEqual(retriedResult, { ok: true }, "第二次合法响应应成功解析");
    assert.equal(retryHarness.callCount, 2, "解析失败后必须且只能重试一次");
    assert.equal(
      retryHarness.requestBodies[1].messages.length,
      2,
      "重试请求必须在原消息后追加纠正消息",
    );
    assert.deepEqual(
      retryHarness.requestBodies[1].messages.at(-1),
      { role: "user", content: retryMessage },
      "重试必须使用指定的 JSON 纠正消息",
    );

    const emptyHarness = installFetchHarness([
      { content: "" },
      { content: "  \n\t" },
    ]);
    await assert.rejects(
      createClient().completeJson({
        task: "empty-content",
        messages: [{ role: "user", content: "返回 JSON" }],
      }),
      /LLM JSON parsing failed after 2 attempts:.*empty/i,
      "连续空 content 必须抛出清晰错误",
    );
    assert.equal(emptyHarness.callCount, 2, "空 content 最多重试一次");

    const invalidHarness = installFetchHarness([
      { content: "完全非法的文本" },
      { content: "仍然不是 JSON" },
    ]);
    await assert.rejects(
      createClient().completeJson({
        task: "invalid-content",
        messages: [{ role: "user", content: "返回 JSON" }],
      }),
      /LLM JSON parsing failed after 2 attempts:.*valid JSON value/i,
      "连续两次非法文本必须抛出清晰错误",
    );
    assert.equal(
      invalidHarness.callCount,
      2,
      "连续两次解析失败后不得发起第三次请求",
    );

    const secret = `sk-${"a".repeat(32)}`;
    const upstreamHarness = installFetchHarness([
      {
        status: 429,
        statusText: "Too Many Requests",
        payload: {
          error: {
            message: `Authorization: Bearer ${secret} ${"x".repeat(700)}`,
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
          },
          details: "完整敏感响应不得进入错误消息",
        },
      },
    ]);
    let upstreamError;
    try {
      await createClient().completeJson({
        task: "upstream-error",
        messages: [{ role: "user", content: "返回 JSON" }],
      });
    } catch (error) {
      upstreamError = error;
    }
    assert.ok(upstreamError instanceof Error, "服务端 error 对象必须抛出 Error");
    assert.match(upstreamError.message, /status 429/);
    assert.match(upstreamError.message, /rate_limit_error/);
    assert.match(upstreamError.message, /rate_limit_exceeded/);
    assert.doesNotMatch(upstreamError.message, new RegExp(secret));
    assert.doesNotMatch(upstreamError.message, /完整敏感响应/);
    assert.ok(
      upstreamError.message.length <= 550,
      "服务端错误摘要不得超过 500 字符（不含固定错误前缀）",
    );
    assert.equal(upstreamHarness.callCount, 1, "服务端 error 对象不得触发解析重试");

    const successErrorHarness = installFetchHarness([
      {
        status: 200,
        payload: {
          error: {
            message: "provider rejected request",
            type: "invalid_request_error",
            code: "bad_request",
          },
        },
      },
    ]);
    await assert.rejects(
      createClient().completeJson({
        task: "error-object-with-200",
        messages: [{ role: "user", content: "返回 JSON" }],
      }),
      /provider rejected request.*invalid_request_error.*bad_request/,
      "HTTP 200 中的服务端 error 对象也必须优先报告",
    );
    assert.equal(successErrorHarness.callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function runSmoke() {
  await runContractAndMockSmoke();
  await runBusinessFlowSmoke();
  await runLLMClientSmoke();
}

try {
  await runSmoke();
  console.log("Smoke checks passed.");
} catch (error) {
  console.error("Smoke checks failed:", error);
  process.exitCode = 1;
}
