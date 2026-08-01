# Parallel API Contracts

本文件只锁定并行模块之间的函数边界。数据字段及运行时校验以 `src/contracts/` 为准；模块不得复制或放宽共享校验。

## 通用约定

- 所有 `options` 均可省略；当前公共字段只有 `signal?: AbortSignal`。
- 结构化模型响应必须是原始 JSON，使用前执行对应运行时校验；空值或无效 JSON 最多重试一次。
- 模型不得生成项目或角色的 `id`、`createdAt`、`updatedAt`。
- 函数只返回数据，不操作 DOM、IndexedDB 或猫箱网页。

## 统一模块入口

第二波 UI 与 QA 统一从以下 barrel 导入，不再自行拼接模块内部路径：

- `src/contracts.js`
- `src/generation/index.js`
- `src/evaluation/index.js`
- `src/editing/index.js`
- `src/platforms/maoxiang/index.js`
- `src/storage/index.js`
- `src/workflow/index.js`
- `src/mock/index.js`

## Character Intelligence

```js
analyzeCreativeSeed(seed, llmClient, options)
  => Promise<{
    questions: Array<{
      id: string,
      prompt: string,
      options: string[],       // 3—5 项
      recommended: string      // 必须来自 options
    }>
  }>
```

`seed` 是通过 `assertCreativeSeed` 的 `{ text }`。`questions` 最多 3 项；空数组表示信息充分或无需追问。

```js
generateCharacterFromSeed(seed, answers, llmClient, options)
  => Promise<{
    title: string,
    brief: CreativeBrief,
    worldSummary: string | null,
    character: CharacterDraft
  }>
```

`answers` 是以问题 `id` 为键、字符串答案为值的普通对象。默认生成一个角色；现有 `generateConcepts` 三方向接口保持不变。

## World And Story

```js
generateWorldBible(context, llmClient, options)
  => Promise<WorldBible>

generateStoryDraft(context, llmClient, options)
  => Promise<StoryDraft>
```

`context` 只包含本次生成需要的 `seed`、`brief`、`character`、`worldBible` 或 `storyDraft` 字段。世界规则最多 8 条、地点最多 5 个、势力最多 4 个；故事必须正好 8 个 `keyNodes`，并遵守契约中的分支、伏笔和状态变量上限。

## Platform

```js
createMaoxiangPack(project, flowId, llmClient, options)
  => Promise<PlatformPack>
```

`project` 是有效 `ProjectDocument`，并至少包含当前入口需要的 `character` 或 `storyDraft`。该入口是未来统一适配器；现有兼容接口 `generateMaoxiangPack(character, flowId, llmClient)` 保持可用。

共享 `PlatformPack.flowId` 接受 `editor_character`、`free_character`、`dead_rival`、`image_shape`、`editor_open_story` 与仅用于旧项目兼容的 `open_story`。新项目不得生成禁用的 `open_story`。

## Editing

```js
applyConfirmedRevision(project, revision)
  => {
    project: ProjectDocument,
    historyEntry: {
      fieldPath: string,
      before: JsonValue,
      after: JsonValue,
      appliedAt: string
    }
  }
```

`revision` 形状固定为 `{ fieldPath, before, after, summary }`。只允许修改已有单字段；输入项目不得原地变化。角色字段变化清除依赖该角色的故事，但保留旧评估和平台包供对照。调用方维护最多 20 条 `historyEntry`。

## Workflow Foundation

```js
deriveProjectStatus(project)
  => { completed: Record<string, boolean>, accessibleSteps: string[] }

invalidateProject(project, changeType)
  => ProjectDocument

createTaskRunner()
  => { run(taskId, task), cancel(taskId), cancelAll(), isRunning(taskId) }
```

`changeType` 只允许 `seed | brief | character | world | story`。`task` 接收 `{ signal }`；同一 `taskId` 并发提交会被拒绝。
