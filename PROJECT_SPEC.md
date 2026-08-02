# Female-oriented Character Planner 项目规格

## 1. 产品定位

- 项目名：女性向角色策划与猫箱输入包生成器
- 英文名：Female-oriented Character Planner
- 仓库名：`female-oriented-character-planner`
- 平台定位：面向女性向互动角色创作，以结构化策划、可验证角色数据和猫箱输入包为核心；它不是聊天客户端，也不直接操作猫箱。
- 技术基线：普通 JavaScript ES Modules + Vite。除作为 `devDependency` 的 Vite 外不增加 npm 依赖。

v0.2 核心流程分为角色与开放故事两条：

```text
角色：一句话灵感 → 0—3 个可跳过追问 → 单个完整角色
      └─ 可选探索模式：3 个差异化候选 → 选择 → 完整角色
      → 快速检查 → 角色猫箱输入包 → 字段提案/确认/撤销

故事：一句话灵感 → 0—3 个可跳过追问 → WorldBible
      → StoryDraft（正好 8 个关键节点）→ 开放故事猫箱输入包

任意阶段 → 自动保存、版本恢复、JSON/Markdown 导出
```

## 2. P0 范围

v0.2 包含以下能力边界：

1. 收集并校验 `CreativeSeed`；仅在高影响信息缺失时追问，最多 3 题且都可跳过。
2. 默认直接生成一份 `CreativeBrief` 与完整 `CharacterDraft`；三方向候选是用户显式选择的探索模式，不是主流程前置条件。
3. 生成受数量上限约束的 `WorldBible` 与正好 8 个关键节点的开放 `StoryDraft`。
4. 按字段路径生成单字段修改提案；确认前展示 Diff，确认后只修改目标字段，并支持撤销最近一次确认；旧检查与平台包保留供对照并标记为“可能已过期”。
5. 运行确定性规则检查、固定 3 场景快速测试和固定 8 场景完整测试；`warning` 不阻断有效平台文本复制，`error` 阻断。
6. 将项目转换为 `editor_character`、`free_character`、`dead_rival`、`image_shape` 或 `editor_open_story` 猫箱输入包，并统一校验已知规则。
7. 任意阶段项目均可本地自动保存、显式保存版本、恢复版本、导入/导出 JSON 和导出 Markdown。
8. 正式 UI 提供创建角色、创建开放故事、打开项目和导入 JSON；模型任务和底层 HTTP 请求均可取消，迟到结果不得污染项目。
9. `open_story` 仅为旧数据兼容保留；新开放故事入口固定为 `editor_open_story`。

## 3. 明确非目标

首版不实现：

- 自动登录或操作猫箱
- 自动发布
- 批量创建或养号
- 图片生成 API
- 语音
- TXT 小说提取或小说转换
- 完整聊天前端
- 多 Agent
- 0—100 主观质量评分
- 用户系统
- 云同步
- 静态站点内硬编码 API Key

同时禁止引入 React、Vue、TypeScript、后端框架、LangChain、Agent 框架、状态管理库、CSS 框架、测试框架、向量数据库或云数据库。

## 4. 猫箱入口与字段

`PlatformPack.flowId` 只允许当前受支持或为旧数据兼容而保留的入口标识；新项目可生成前五项。`currentLength` 一律使用 `Array.from(text).length` 计算。

| 入口 `flowId` | 字段 | 限制 | 验证状态 | v0.2 状态 |
| --- | --- | --- | --- | --- |
| `editor_character` | 8 个编辑器角色字段 | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `free_character` | `characterPrompt` | 最大 1000 字 | 已由实机截图确认 | 启用 |
| `dead_rival` | `rivalSetting` | 最大 300 字 | 已确认 | 启用 |
| `dead_rival` | `history` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `dead_rival` | `other` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `image_shape` | `imagePrompt` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `image_shape` | `styleSuggestion` | 只能是 `通用`、`像素画`、`言情漫画`、`细腻厚涂` | 枚举已锁定 | 启用 |
| `editor_open_story` | `storyPrompt` | 最大 10000 字 | 已记录 | 启用 |
| `editor_open_story` | 其余 6 个开放故事字段 | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `open_story` | `storyPrompt` | 最大 10000 字 | 已记录 | 禁用，仅保留旧数据兼容 |

已知上限对应 block 的 `maxLength` 为数字，`verified` 为 `true`；未知上限的 `maxLength` 为 `null`，`verified` 为 `false`。`valid` 表示该 block 是否满足所有已知规则。不得把未知上限自行替换成推测值。

## 5. 数据契约

所有契约在 `src/contracts.js` 中以 JSDoc 描述，并以手写运行时校验实现。不得引入 schema 库，不得改名或静默增加字段。所有校验失败统一抛出简单 `Error`，错误信息必须包含失败字段路径。

除明确写为 `number | null` 或“任意可序列化值”的字段外，以下字段均为必填且类型必须准确。这里的可序列化值指 JSON 可表达的 `null`、字符串、有限数字、布尔值、可序列化值数组或由可序列化值组成的普通对象；不包括 `undefined`、函数、Symbol、BigInt、循环引用和非有限数字。

### 5.0 `CreativeSeed`

```text
text: string
```

只接受该单一字段，`text` 去除空白后必须非空。

### 5.1 `CreativeBrief`

```text
platform: "maoxiang"
outputMode: "free_character" | "dead_rival" | "image_shape"
characterGender: string
ageRange: string
worldSetting: string
characterIdentity: string
coreExperiences: string[]
relationshipType: string
coreConflict: string
personalityContradiction: string
initiativeLevel: "low" | "medium" | "high"
interactionTone: string[]
boundaries: string[]
bannedBehaviors: string[]
extraNotes: string
```

### 5.2 `ConceptCandidate`

```text
id: string
name: string
oneLiner: string
coreExperience: string
initialRelation: string
coreConflict: string
uniqueBehavior: string
firstInteraction: string
longTermPotential: string
differenceSummary: string
```

候选生成结果是正好包含 3 项的 `ConceptCandidate[]`，三项必须明显不同。

### 5.3 `CharacterDraft`

```text
meta:
  id: string
  name: string
  createdAt: string
  updatedAt: string

publicInfo:
  name: string
  oneLiner: string
  appearance: string
  tags: string[]

persona:
  identity: string
  background: string
  currentGoal: string
  secret: string
  desire: string
  fear: string
  contradiction: string
  concreteBehaviors: string[]
  initiativeRules: string[]
  forbiddenBehaviors: string[]

relationship:
  initialRelation: string
  attractionConditions: string[]
  stages: Array<{
    name: string
    trigger: string
    behavior: string
  }>
  conflictPattern: string
  repairPattern: string

dialogueStyle:
  addressStyle: string
  sentenceStyle: string
  replyLength: string
  actionNarration: string
  emotionalExpression: string
  bannedPhrases: string[]
  examples: Array<{
    user: string
    character: string
  }>

openings:
  plotOpening: string
  dailyOpening: string
  tensionOpening: string

imageDesign:
  appearancePrompt: string
  styleSuggestion: string
```

### 5.4 `FieldPatch`

```text
fieldPath: string
value: 任意可序列化值
```

`fieldPath` 使用点分隔路径；数组项使用十进制索引段，例如 `relationship.stages.0.behavior`。路径必须指向已有字段，不得借补丁静默扩展契约。

### 5.5 `RuleCheckReport`

```text
status: "pass" | "warning" | "fail"
issues: Array<{
  code: string
  severity: "warning" | "error"
  fieldPath: string
  message: string
  evidence: string
  suggestedAction: string
}>
```

### 5.6 `SimulationReport`

```text
status: "pass" | "warning" | "fail"
scenarios: Array<{
  scenarioId: string
  userInput: string
  characterResponse: string
  issues: string[]
  evidence: string[]
  suggestedFields: string[]
}>
summary: string
```

对话测试结果必须正好包含 8 个场景。

### 5.7 `PlatformPack`

```text
platform: "maoxiang"
flowId: string
blocks: Array<{
  id: string
  label: string
  text: string
  maxLength: number | null
  currentLength: number
  valid: boolean
  verified: boolean
}>
generatedAt: string
```

每个 block 的 `currentLength` 必须等于 `countUnicodeCharacters(text)`。`free_character.characterPrompt` 不得超过 1000 字；`dead_rival.rivalSetting` 不得超过 300 字；`image_shape.styleSuggestion` 必须属于锁定枚举。

### 5.8 `CharacterProject`

`CharacterProject` 是旧完整角色项目的兼容契约，继续用于导入迁移，不是 v0.2 的持久化根对象。

```text
id: string
title: string
brief: CreativeBrief
concepts: ConceptCandidate[]
selectedConceptId: string
character: CharacterDraft
ruleReport: RuleCheckReport
simulationReport: SimulationReport
platformPacks: PlatformPack[]
createdAt: string
updatedAt: string
```

### 5.9 `WorldBible`

```text
summary: string
rules: string[]          // 最多 8 项
locations: string[]      // 最多 5 项
factions: string[]       // 最多 4 项
canonFacts: string[]
forbiddenFacts: string[]
```

### 5.10 `StoryDraft`

```text
title: string
oneLiner: string
userIdentity: string
mainCharacters: string[]
premise: string
coreConflict: string
initialScene: string
openingLine: string
keyNodes: string[]       // 正好 8 项
branches: string[]       // 最多 4 项
foreshadowing: string[]  // 最多 6 项
stateVariables: string[] // 最多 3 项
```

### 5.11 `GenerationRecord`

```text
id: string
task: string
target: string
status: "completed" | "cancelled" | "failed"
createdAt: string
```

### 5.12 `ProjectDocument`

```text
id: string
title: string
seed: CreativeSeed | null
brief: CreativeBrief | null
concepts: ConceptCandidate[]          // 空数组或正好 3 项
selectedConceptId: string | null
character: CharacterDraft | null
worldBible: WorldBible | null
storyDraft: StoryDraft | null
ruleReport: RuleCheckReport | null
simulationReport: SimulationReport | null
platformPacks: PlatformPack[]
generationRecords: GenerationRecord[]
createdAt: string
updatedAt: string
```

`ProjectDocument` 是 v0.2 的持久化根对象，允许任意生成阶段保存；未生成对象使用 `null`，集合使用空数组。非空 `selectedConceptId` 必须指向当前 `concepts` 中的候选。

## 6. 契约工具公开接口

`src/contracts.js` 必须导出以下函数；成功时正常返回，失败时按第 5 节规则抛出 `Error`：

```js
assertCreativeSeed(value)
assertCreativeBrief(value)
assertConceptCandidates(value)
assertCharacterDraft(value)
assertFieldPatch(value)
assertRuleCheckReport(value)
assertSimulationReport(value)
assertPlatformPack(value)
assertCharacterProject(value)
assertWorldBible(value)
assertStoryDraft(value)
assertGenerationRecord(value)
assertProjectDocument(value)

getValueAtPath(object, fieldPath)
applyFieldPatch(object, patch)
countUnicodeCharacters(text)
createId(prefix)
```

行为锁定如下：

- `assertConceptCandidates` 校验正好 3 个候选。
- `assertSimulationReport` 校验正好 8 个场景。
- `getValueAtPath` 按第 5.4 节的点分隔路径读取已有值；无效路径抛出包含该路径的 `Error`。
- `applyFieldPatch` 先校验补丁和路径，返回应用补丁后的深拷贝，绝不原地修改输入对象。
- `countUnicodeCharacters(text)` 必须使用 `Array.from(text).length`。
- `createId(prefix)` 返回带给定前缀的非空唯一字符串标识。

## 7. 统一 `LLMClient` 接口

所有生成模块只依赖以下统一接口：

```js
completeJson({
  task,
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  signal
}) => Promise<object>

completeText({
  task,
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  signal
}) => Promise<string>
```

- `task` 只供 mock 客户端识别，真实客户端可以忽略。
- `messages` 是传给模型的消息数组。
- `signal` 是可选 `AbortSignal`；真实客户端必须传给底层 `fetch`，调用链在异步边界后也必须检查取消状态。
- 结构化响应必须是原始 JSON，不得包在 Markdown 代码围栏中。
- 使用模型 JSON 前必须通过相应契约校验；空响应或无效 JSON 最多重试一次。
- API Key 只能由本地 Vite 代理从服务端环境读取并注入，不能进入客户端、Git、`VITE_` 环境变量、IndexedDB 或 localStorage。

`src/mock/mock-llm-client.js` 公开导出：

```js
createMockLLMClient() => LLMClient
```

mock 必须稳定且至少识别这些 `task`：

- `seed-analysis`：返回 0—3 个高影响追问；问题 ID 由本地生成。
- `direct-character-generation`：返回项目标题、简报、可选世界摘要和单个角色正文；应用元数据由本地生成。
- `concept-generation`：返回正好 3 个明显不同且通过校验的候选。
- `character-expansion`：返回通过校验的 `CharacterDraft`。
- `field-regeneration`：只返回 `{ fieldPath, value }`。
- `world-generation`：返回通过校验且不超过数量上限的 `WorldBible`。
- `story-generation`：返回正好 8 个关键节点的 `StoryDraft`。
- `quick-dialogue-test`：返回固定 3 场景的模块级快速报告。
- `dialogue-evaluation`：返回正好 8 个场景且通过校验的报告。
- `maoxiang-free-character`：生成的 `characterPrompt` 不超过 1000 字。
- `maoxiang-dead-rival`：生成的 `rivalSetting` 不超过 300 字。
- `maoxiang-image-shape`：生成合法风格枚举和图像描述字段。
- `maoxiang-compress-fields`：只返回点名的已知超限字段，每个输入包最多调用一次。

## 8. 业务模块公开接口

以下签名为已实现的锁定接口；完整导出以各模块 `index.js` 为准：

```js
analyzeCreativeSeed(seed, llmClient, options)
generateCharacterFromSeed(seed, answers, llmClient, options)
generateConcepts(brief, llmClient)
expandCharacter(concept, brief, llmClient)
regenerateField(character, fieldPath, instruction, llmClient)
generateWorldBible(context, llmClient, options)
generateStoryDraft(context, llmClient, options)

checkRules(character)
runQuickDialogueTest(character, llmClient, options)
runDialogueTest(character, llmClient)

generateMaoxiangPack(character, flowId, llmClient)
createMaoxiangPack(project, flowId, llmClient, options)
validatePlatformPack(pack)

proposeFieldRevision(project, fieldPath, instruction, context, llmClient, options)
applyConfirmedRevision(project, revision)
undoRevision(project, history)

saveProject(project)
getProject(id)
listProjects()
deleteProject(id)
saveVersion(projectId, snapshot)
listVersions(projectId)
restoreVersion(projectId, versionId)
exportProjectJson(projectId)
exportProjectMarkdown(projectId)
importProjectJson(fileContent)
createAutosaveService(options)
```

不得修改函数名、参数顺序或业务返回内容。持久化前后的项目必须通过 `assertProjectDocument`；旧 `CharacterProject` 只在迁移入口校验。`regenerateField` 只返回补丁，字段提案在用户确认前不得修改项目。

## 9. 应用状态契约

`src/app-state.js` 导出纯对象状态创建器。持久业务数据统一放在 `project: ProjectDocument`，其余均为不得写入项目的瞬时 UI 状态，包括：

```text
mode: "mock" | "real"
currentStep: "home" | "create" | "questions" | "progress" | "concepts" | "result" | "storage"
projectKind: "character" | "story"
generationMode: "direct" | "explore"
questions, answers, progress, progressStatus
quickDialogueReport, storyCheck
pendingRevision, revisionDiff, revisionHistory
savedProjects, versions, autosaveStatus
loading, pendingAction, error, notice, dirty
```

所有保存、恢复和导出只消费通过 `assertProjectDocument` 的 `project`；快速 3 场景报告、Diff、撤销栈和界面反馈不得静默加入持久化契约。

## 10. 模块目录所有权

每个 Worktree 只能修改其被分配的文件。共享锁定文件只能由 `foundation` 或 `final-integration` 修改；其他模块若需要变更契约，必须在自己的交付说明中提出，不能直接编辑。

| Worktree / 模块 | 独占目录或文件 | 责任边界 |
| --- | --- | --- |
| `foundation` | 根目录配置与文档、`index.html`、`scripts/smoke.mjs`、`src/contracts.js`、`src/app-state.js`、`src/app.js`、`src/styles.css`、`src/mock/` | Vite 骨架、锁定契约、mock、最小页面与基础 smoke；唯一可在初始阶段编辑 `package.json`、`PROJECT_SPEC.md`、`src/contracts.js` 的模块 |
| `concept-character` | `src/generation/` | seed、单角色、三方向、世界、故事和字段生成；不得接管状态、平台或存储 |
| `rule-dialogue` | `src/evaluation/`、`src/editing/` | 固定规则、3/8 场景评估、字段提案、Diff、确认与撤销 |
| `maoxiang-pack` | `src/platforms/` | 五种新项目入口、旧入口兼容、统一规则、字段映射与验证 |
| `persistence-export` | `src/storage/` | 项目和版本存储、自动保存、迁移、JSON/Markdown 导入导出 |
| `ui` | `src/ui/` | 正式表单、流程视图和交互组件；不修改生成、评估、平台或存储实现 |
| `final-integration` | 集成入口和全部共享文件 | 按锁定接口接线、处理合并冲突、补集成验证；只有此阶段可再次修改 `package.json`、`PROJECT_SPEC.md` 或 `src/contracts.js` |

任何模块都不得在自己的所有权范围外复制另一模块的实现，也不得新增平行契约或重命名公开字段。

## 11. Worktree 合并顺序

严格按以下顺序合并；同一序号内可以并行开发，但合并仍按表中次序逐个完成并在每次合并后解决冲突：

1. `foundation`
2. `concept-character`
3. `rule-dialogue`
4. `maoxiang-pack`
5. `persistence-export`
6. `ui`
7. `final-integration`

除 `foundation` 外的所有 Worktree 都必须基于 foundation commit 创建或 rebase 到该提交。每次合并后至少运行 `npm run build` 与 `npm run smoke`；`final-integration` 负责最终全量接线和验收。不得通过抢先编辑共享文件规避合并顺序。

## 12. 本地 LLM 代理与环境

- `.env.example` 固定包含 `LLM_BASE_URL=https://api.deepseek.com`、空的 `LLM_API_KEY=` 和 `VITE_LLM_MODEL=deepseek-v4-flash`。
- `.worktreeinclude` 固定包含 `.env.local`，用于 Codex 本地 Worktree 复制被 Git 忽略的环境文件。
- `vite.config.js` 使用 `defineConfig` 和 `loadEnv(mode, process.cwd(), '')`。
- `server.proxy` 与 `preview.proxy` 共用 `/api/llm` 代理规则。
- 代理 `target` 是 `LLM_BASE_URL`，`changeOrigin: true`，`secure: true`。
- `/api/llm/chat/completions` 重写为 `/chat/completions`。
- 代理请求从服务端环境注入 `Authorization: Bearer <LLM_API_KEY>`。
- 未设置 `LLM_API_KEY` 时开发服务器和构建不得崩溃；真实请求可以由上游返回认证错误。
- 浏览器只读取非敏感的 `VITE_LLM_MODEL`，绝不通过 `import.meta.env` 暴露 API Key。

## 13. 正式页面边界

正式 UI 只编排已经存在的模块能力，并固定提供：

- 首页四个入口：创建角色、创建开放故事、打开已有项目、导入 JSON。
- 默认折叠的高级表单；角色主流程不强制生成三个候选。
- 最多 3 个可跳过追问和四个真实生成阶段。
- 角色/故事结果、检查报告、平台字段、单字段提案 Diff、确认与撤销。
- 自动保存、版本恢复、JSON/Markdown 导出和请求取消。

UI 不得自行计算平台 `valid`、复制存储防抖、循环自动修复、暴露密钥或自动操作猫箱网页。

## 14. v0.2 验收标准

1. 角色流程从一句话贯通到完整角色、自动平台包、可选快速检查、字段提案/确认/撤销、自动保存、刷新恢复和双格式导出。
2. 故事流程生成 `WorldBible`、`StoryDraft`、正好 8 个关键节点和 `editor_open_story` 平台包，并可保存与导出。
3. 旧裸 `CharacterProject`、schema v1 与 schema v2 JSON 均按第 5 节迁移和校验；未来高版本明确拒绝。
4. 所有模型结构化响应是原始 JSON；无效响应最多重试一次；ID 与时间戳由本地生成。
5. `warning` 不阻止有效平台文本复制，`error` 与平台字段无效状态会阻止复制；未知上限不被猜测。
6. 模型请求可取消，真实客户端把 `AbortSignal` 传给 `fetch`，迟到结果不会覆盖项目。
7. Git 中不存在 API Key、`.env.local`、构建产物或调试日志；生产平台规则只有一个来源。
8. 依次成功运行 `npm ci`、`npm test`、`npm run smoke`、`npm run build` 与 `git diff --check`。
9. 使用真实浏览器验证角色、故事、旧 JSON 迁移、刷新恢复、导出和取消流程。
10. 版本为适当的 `0.2.x`，并提供 `CHANGELOG.md`、最终 README 和 `docs/IMPLEMENTATION_SUMMARY_V2.md`。
