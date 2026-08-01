# Character Intelligence Handoff

## Implemented

- 实现一句话种子分析；只保留高影响缺失问题，最多 3 题，每题 3—5 个选项且推荐值来自选项。
- 实现默认单方案生成；一次结构化调用返回项目标题、`CreativeBrief`、可选轻量世界摘要和一个完整 `CharacterDraft`。
- 将角色 `id`、`createdAt`、`updatedAt` 收口为本地生成，并统一 `meta.name` 与 `publicInfo.name`；现有候选扩展路径同步采用相同规则。
- 保留现有 `generateConcepts` 三方向模式，并为三方向 Mock 提供兼容任务别名。
- 实现静态字段上下文裁剪，只传递相关简报、世界与角色字段，不携带故事、评估、平台包、历史或项目元数据。
- 新增精简的种子分析与默认角色生成提示词，以及稳定的对应 Mock 和生成模块测试。

## Public API

- `analyzeCreativeSeed(seed, llmClient, options) => Promise<{ questions }>`
- `generateCharacterFromSeed(seed, answers, llmClient, options) => Promise<{ title, brief, worldSummary, character }>`
- `selectContextForField(project, fieldPath) => { brief, worldBible, character }`
- 兼容保留：`generateConcepts(brief, llmClient) => Promise<ConceptCandidate[]>`
- 兼容保留：`expandCharacter(concept, brief, llmClient) => Promise<CharacterDraft>`

## Data Migration

- None.

## Verification

- `node --test tests/generation/character-intelligence.test.mjs` — 6 tests passed.
- `npm run smoke` — passed.
- `npm run build` — passed.

## Integration Notes

- 提示词版本：`seed-analysis/v1`、`brief-character-generation/v1`。
- Mock 任务名：`seed-analysis`、`direct-character-generation`、`concept-generation`；`three-direction-generation` 是三方向兼容别名。
- 默认生成只有一次 `completeJson` 调用；未增加模型调用循环。
- 新默认入口不创建三个候选；探索模式继续使用原有 `generateConcepts`。

## Requested Shared Change

- None.

## Real Open Issues

- None.
