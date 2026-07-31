# Female-oriented Character Planner 项目规格

## 1. 产品定位

- 项目名：女性向角色策划与猫箱输入包生成器
- 英文名：Female-oriented Character Planner
- 仓库名：`female-oriented-character-planner`
- 平台定位：面向女性向互动角色创作，以结构化策划、可验证角色数据和猫箱输入包为核心；它不是聊天客户端，也不直接操作猫箱。
- 技术基线：普通 JavaScript ES Modules + Vite。除作为 `devDependency` 的 Vite 外不增加 npm 依赖。

P0 核心流程固定为：

```text
创作简报
→ 正好 3 个差异化候选
→ 选择候选
→ 扩展完整角色
→ 单字段重新生成
→ 固定规则检查
→ 8 场景模拟测试
→ 猫箱输入包转换
→ 本地保存、版本恢复、JSON/Markdown 导出
```

## 2. P0 范围

P0 包含以下能力边界：

1. 收集并校验 `CreativeBrief`。
2. 生成正好 3 个明显不同且符合 `ConceptCandidate` 契约的候选。
3. 选择一个候选并扩展为完整 `CharacterDraft`。
4. 按字段路径重新生成单个字段；结果只能是 `FieldPatch`，不得覆盖整个角色。
5. 运行确定性的固定规则检查，生成 `RuleCheckReport`。
6. 运行正好 8 个场景的角色对话模拟测试，生成 `SimulationReport`。
7. 将角色转换为 `free_character`、`dead_rival` 或 `image_shape` 猫箱输入包，并再次校验长度、枚举和已知限制。
8. 本地保存项目、保存版本、恢复版本、导入与导出 JSON、导出 Markdown。
9. 记录 `open_story` 配置，但 MVP 中禁用该入口，且不把它加入 `CreativeBrief.outputMode`。

基础阶段只提供可运行的 Vite 骨架、契约、稳定 mock、最小状态和 smoke 验证；不提前实现上述正式业务模块或完整 UI。

## 3. 明确非目标

首版不实现：

- 自动登录或操作猫箱
- 自动发布
- 批量创建或养号
- 图片生成 API
- 语音
- 世界书
- 小说转换
- 完整聊天前端
- 多 Agent
- 0—100 主观质量评分
- 用户系统
- 云同步
- 静态站点内硬编码 API Key

同时禁止引入 React、Vue、TypeScript、后端框架、LangChain、Agent 框架、状态管理库、CSS 框架、测试框架、向量数据库或云数据库。

## 4. 猫箱入口与字段

`PlatformPack.flowId` 只允许当前受支持或被记录的入口标识；生成接口的 P0 可用入口是前三项。`currentLength` 一律使用 `Array.from(text).length` 计算。

| 入口 `flowId` | 字段 | 限制 | 验证状态 | P0 状态 |
| --- | --- | --- | --- | --- |
| `free_character` | `characterPrompt` | 最大 1000 字 | 已由实机截图确认 | 启用 |
| `dead_rival` | `rivalSetting` | 最大 300 字 | 已确认 | 启用 |
| `dead_rival` | `history` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `dead_rival` | `other` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `image_shape` | `imagePrompt` | 上限未知 | 未确认 | 启用，不作臆测性长度限制 |
| `image_shape` | `styleSuggestion` | 只能是 `通用`、`像素画`、`言情漫画`、`细腻厚涂` | 枚举已锁定 | 启用 |
| `open_story` | `storyPrompt` | 最大 10000 字 | 已记录 | MVP 禁用，仅保留配置 |

已知上限对应 block 的 `maxLength` 为数字，`verified` 为 `true`；未知上限的 `maxLength` 为 `null`，`verified` 为 `false`。`valid` 表示该 block 是否满足所有已知规则。不得把未知上限自行替换成推测值。

## 5. 数据契约

所有契约在 `src/contracts.js` 中以 JSDoc 描述，并以手写运行时校验实现。不得引入 schema 库，不得改名或静默增加字段。所有校验失败统一抛出简单 `Error`，错误信息必须包含失败字段路径。

除明确写为 `number | null` 或“任意可序列化值”的字段外，以下字段均为必填且类型必须准确。这里的可序列化值指 JSON 可表达的 `null`、字符串、有限数字、布尔值、可序列化值数组或由可序列化值组成的普通对象；不包括 `undefined`、函数、Symbol、BigInt、循环引用和非有限数字。

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

## 6. 契约工具公开接口

`src/contracts.js` 必须导出以下函数；成功时正常返回，失败时按第 5 节规则抛出 `Error`：

```js
assertCreativeBrief(value)
assertConceptCandidates(value)
assertCharacterDraft(value)
assertFieldPatch(value)
assertRuleCheckReport(value)
assertSimulationReport(value)
assertPlatformPack(value)
assertCharacterProject(value)

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
  maxTokens = 4096
}) => Promise<object>

completeText({
  task,
  messages,
  temperature = 0.7,
  maxTokens = 4096
}) => Promise<string>
```

- `task` 只供 mock 客户端识别，真实客户端可以忽略。
- `messages` 是传给模型的消息数组。
- 结构化响应必须是原始 JSON，不得包在 Markdown 代码围栏中。
- 使用模型 JSON 前必须通过相应契约校验；空响应或无效 JSON 最多重试一次。
- API Key 只能由本地 Vite 代理从服务端环境读取并注入，不能进入客户端、Git、`VITE_` 环境变量、IndexedDB 或 localStorage。

`src/mock/mock-llm-client.js` 公开导出：

```js
createMockLLMClient() => LLMClient
```

mock 必须稳定且至少识别这些 `task`：

- `concept-generation`：返回正好 3 个明显不同且通过校验的候选。
- `character-expansion`：返回通过校验的 `CharacterDraft`。
- `field-regeneration`：只返回 `{ fieldPath, value }`。
- `dialogue-evaluation`：返回正好 8 个场景且通过校验的报告。
- `maoxiang-free-character`：生成的 `characterPrompt` 不超过 1000 字。
- `maoxiang-dead-rival`：生成的 `rivalSetting` 不超过 300 字。
- `maoxiang-image-shape`：生成合法风格枚举和图像描述字段。

## 8. 业务模块公开接口

以下签名为锁定接口。基础阶段只记录，不实现正式逻辑：

```js
generateConcepts(brief, llmClient)
  => Promise<ConceptCandidate[]>

expandCharacter(concept, brief, llmClient)
  => Promise<CharacterDraft>

regenerateField(character, fieldPath, instruction, llmClient)
  => Promise<FieldPatch>

checkRules(character)
  => RuleCheckReport

runDialogueTest(character, llmClient)
  => Promise<SimulationReport>

generateMaoxiangPack(character, flowId, llmClient)
  => Promise<PlatformPack>

validatePlatformPack(pack)
  => PlatformPack

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
```

持久化与导入导出接口的异步形式由其实现模块统一采用，但不得修改函数名、参数顺序或业务返回内容。任何持久化前后的完整项目都必须通过 `assertCharacterProject`。`regenerateField` 只返回补丁，调用者随后通过 `applyFieldPatch` 生成新角色。

## 9. 应用状态契约

`src/app-state.js` 在基础阶段只导出 `createInitialAppState()`。状态包含与 `CharacterProject` 同名的业务字段，以及：

```text
mode: "mock" | "real"
currentStep
loading
error
```

未完成流程的业务值可以在工作态中为空；一旦作为 `CharacterProject` 保存或导出，必须满足第 5.8 节完整契约。基础阶段不实现正式 UI 状态流转。

## 10. 模块目录所有权

每个 Worktree 只能修改其被分配的文件。共享锁定文件只能由 `foundation` 或 `final-integration` 修改；其他模块若需要变更契约，必须在自己的交付说明中提出，不能直接编辑。

| Worktree / 模块 | 独占目录或文件 | 责任边界 |
| --- | --- | --- |
| `foundation` | 根目录配置与文档、`index.html`、`scripts/smoke.mjs`、`src/contracts.js`、`src/app-state.js`、`src/app.js`、`src/styles.css`、`src/mock/` | Vite 骨架、锁定契约、mock、最小页面与基础 smoke；唯一可在初始阶段编辑 `package.json`、`PROJECT_SPEC.md`、`src/contracts.js` 的模块 |
| `concept-character` | `src/generation/` | `generateConcepts`、`expandCharacter`、`regenerateField`；不得接管状态、平台或存储 |
| `rule-dialogue` | `src/evaluation/` | `checkRules`、`runDialogueTest` 和 8 场景评估编排 |
| `maoxiang-pack` | `src/platforms/` | `generateMaoxiangPack`、`validatePlatformPack`、猫箱字段映射与限制 |
| `persistence-export` | `src/persistence/`、`src/export/` | 项目和版本存储、恢复、JSON/Markdown 导入导出 |
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

## 13. 基础页面边界

`index.html`、`src/app.js`、`src/styles.css` 在基础阶段只显示：

- 项目名称
- “基础环境可用”
- 当前 `VITE_LLM_MODEL`
- 一个运行 mock smoke 的按钮

不得在基础阶段实现正式表单、完整 UI 或正式业务流程。

## 14. 验收标准

基础阶段只有同时满足以下条件才算完成：

1. 根目录存在规定文件：`AGENTS.md`、`PROJECT_SPEC.md`、`README.md`、`LICENSE`、`package.json`、`package-lock.json`、`vite.config.js`、`.gitignore`、`.env.example`、`.worktreeinclude`、`index.html`、`scripts/smoke.mjs`、`src/contracts.js`、`src/app-state.js`、`src/app.js`、`src/styles.css`、`src/mock/mock-llm-client.js`。
2. `package.json` 的 `type` 为 `module`；脚本精确提供 `dev: vite`、`dev:lan: vite --host 0.0.0.0`、`build: vite build`、`preview: vite preview`、`smoke: node scripts/smoke.mjs`。
3. 唯一新增 npm 依赖是作为 `devDependency` 的 Vite。
4. `.gitignore` 至少忽略 `node_modules/`、`dist/`、`.env.local`、`.env.*.local`、`*.log`。
5. 本地 LLM 代理满足第 12 节全部安全和转发规则，Git 中不存在 API Key。
6. `src/contracts.js` 可导入，导出第 6 节全部接口，并对第 5 节全部契约进行路径明确的运行时校验。
7. `applyFieldPatch` 返回深拷贝且不修改原对象；Unicode 字符计数使用 `Array.from(text).length`。
8. mock client 可创建，覆盖第 7 节所有任务，并返回稳定且通过相应契约的数据。
9. mock 概念正好 3 个、对话模拟正好 8 个场景、自由创建文本不超过 1000 字、亡者对手设定不超过 300 字。
10. 应用状态和最小页面严格停留在基础阶段边界，不包含正式功能。
11. `scripts/smoke.mjs` 至少验证：契约可导入、mock 可创建、3 个概念、8 个场景、自由创建文本长度、`applyFieldPatch` 不修改原对象；任一失败设置 `process.exitCode = 1`。
12. 依次成功运行 `npm install`、`npm run build`、`npm run smoke` 和 `git status`。
13. 所有基础阶段改动提交到 `main`，提交信息为 `chore: initialize character planner foundation`；如果配置了 `origin`，推送 `main`。

达到这些标准后立即停止，不实现下一模块。
