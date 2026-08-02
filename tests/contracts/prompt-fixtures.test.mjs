import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PROMPT_FIXTURES } from "./prompt-fixtures.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROMPT_DIRECTORY = path.join(REPOSITORY_ROOT, "prompts");
const RAW_JSON_PATTERN = /(?:只输出|只返回)[^\n]*(?:原始|有效|语法有效)[^\n]*JSON|输出有效\s*JSON/iu;
const MULTI_AGENT_REVIEW_PATTERN = /multi[-\s]?agent|多\s*Agent|多个\s*(?:代理|智能体)|(?:代理|智能体).{0,8}(?:审查|评审)/iu;
const INFINITE_RETRY_PATTERN = /(?:无限|持续|反复|循环)(?:地|进行)?(?:重试|再试)|直到(?:成功|通过).{0,12}(?:重试|再试)|不断(?:重试|再试)/u;
const GENERATED_APP_METADATA_PATTERN = /"meta"\s*:\s*\{[\s\S]{0,260}"id"\s*:|"(?:createdAt|updatedAt|generatedAt)"\s*:/u;

const KNOWN_RUNTIME_VERSION_GAPS = [];
const KNOWN_MODEL_METADATA_GAPS = [];

const promptTexts = new Map(
  PROMPT_FIXTURES.map((fixture) => [
    fixture.id,
    readFileSync(path.join(REPOSITORY_ROOT, fixture.file), "utf8"),
  ]),
);

function findRuntimeVersionGaps() {
  return PROMPT_FIXTURES.filter((fixture) => {
    const consumerSource = fixture.consumers
      .map((file) => readFileSync(path.join(REPOSITORY_ROOT, file), "utf8"))
      .join("\n");
    return !consumerSource.includes(fixture.version);
  })
    .map((fixture) => fixture.id)
    .sort();
}

function findModelMetadataGaps() {
  return PROMPT_FIXTURES.filter((fixture) =>
    GENERATED_APP_METADATA_PATTERN.test(promptTexts.get(fixture.id)),
  )
    .map((fixture) => fixture.id)
    .sort();
}

test("Prompt fixture 清单覆盖全部提示词并声明唯一版本", () => {
  const promptFiles = readdirSync(PROMPT_DIRECTORY)
    .filter((file) => file.endsWith(".md"))
    .map((file) => `prompts/${file}`)
    .sort();
  const fixtureFiles = PROMPT_FIXTURES.map((fixture) => fixture.file).sort();
  const versions = PROMPT_FIXTURES.map((fixture) => fixture.version);

  assert.deepEqual(fixtureFiles, promptFiles);
  assert.equal(new Set(versions).size, versions.length);
  for (const fixture of PROMPT_FIXTURES) {
    assert.match(fixture.version, new RegExp(`^${fixture.id}/v\\d+$`, "u"));
  }
});

test("每个提示词都约束原始 JSON 与任务输出结构", () => {
  for (const fixture of PROMPT_FIXTURES) {
    const prompt = promptTexts.get(fixture.id);
    assert.match(prompt, RAW_JSON_PATTERN, `${fixture.id} 缺少原始 JSON 约束`);
    for (const pattern of fixture.structurePatterns) {
      assert.match(prompt, pattern, `${fixture.id} 缺少结构约束 ${pattern}`);
    }
  }
});

test("提示词不要求 Markdown、多 Agent 审查或无限重试", () => {
  for (const fixture of PROMPT_FIXTURES) {
    const prompt = promptTexts.get(fixture.id);
    const markdownLines = prompt
      .split(/\r?\n/u)
      .filter((line) => /Markdown/iu.test(line));

    for (const line of markdownLines) {
      assert.match(
        line,
        /禁止|不得|不要|不能|不使用/u,
        `${fixture.id} 对 Markdown 的表述不是禁止性约束`,
      );
    }
    assert.doesNotMatch(prompt, MULTI_AGENT_REVIEW_PATTERN, fixture.id);
    assert.doesNotMatch(prompt, INFINITE_RETRY_PATTERN, fixture.id);
  }
});

test("运行时提示词版本缺口与 QA 交接清单一致", () => {
  assert.deepEqual(findRuntimeVersionGaps(), KNOWN_RUNTIME_VERSION_GAPS);
});

test("所有运行时请求都携带提示词版本", () => {
  const gaps = findRuntimeVersionGaps();
  assert.deepEqual(gaps, []);
});

test("模型元数据缺口与 QA 交接清单一致", () => {
  assert.deepEqual(findModelMetadataGaps(), KNOWN_MODEL_METADATA_GAPS);
});

test("提示词不要求模型生成应用元数据", () => {
  const gaps = findModelMetadataGaps();
  assert.deepEqual(gaps, []);
});

test("问题与概念提示词把应用 ID 留给本地代码", () => {
  const seedPrompt = promptTexts.get("seed-analysis");
  const conceptPrompt = promptTexts.get("concept-generation");

  assert.doesNotMatch(seedPrompt, /^\s*-\s*`id`\s*:/mu);
  assert.match(seedPrompt, /模型不得输出 `id`/u);
  assert.doesNotMatch(conceptPrompt, /"id"\s*:/u);
  assert.match(conceptPrompt, /模型不得输出 `id`/u);
});
