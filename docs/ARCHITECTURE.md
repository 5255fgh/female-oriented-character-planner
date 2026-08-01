# 架构与模块边界

## 设计目标

系统的根本目标是把不稳定的模型输出隔离在清晰边界内，再把可校验、可保存、可撤销的数据交给界面。生产代码使用 Vanilla JavaScript ES Modules 与 Vite；没有后端业务服务、状态管理框架或 Agent 框架。

核心约束如下：

- `src/contracts.js` 是数据校验统一入口，具体合同位于 `src/contracts/`。
- 模型只返回当前任务的数据；本地代码负责 ID、时间戳、失效规则与持久化。
- 模块通过公开 barrel 互相调用，不复制另一模块的校验或业务逻辑。
- UI 只负责流程编排和渲染，不重新实现生成、平台规则或存储。

## 模块分层

| 层 | 入口 | 责任 |
| --- | --- | --- |
| 合同 | `src/contracts.js` | 严格字段、类型、数量、路径与 Unicode 长度校验 |
| 生成 | `src/generation/index.js` | seed 分析、默认单角色、三方向、世界与故事生成、字段上下文裁剪 |
| 评估 | `src/evaluation/index.js` | 确定性规则、快速 3 场景、完整 8 场景 |
| 编辑 | `src/editing/index.js` | 字段提案、Diff、确认、撤销与历史上限 |
| 平台 | `src/platforms/maoxiang/index.js` | 五种声明式字段适配、验证与一次压缩 |
| 存储 | `src/storage/index.js` | IndexedDB、自动保存、版本、迁移与导入导出 |
| 工作流 | `src/workflow/index.js` | 步骤状态、下游失效和可取消任务 |
| Mock | `src/mock/index.js` | 可重复的离线模型响应与核心链路 fixture |
| UI | `src/app.js`、`src/ui/**` | 瞬时界面状态、用户动作与模块接线 |

模块所有权和并行合并顺序分别以 `docs/parallel/MODULE_OWNERSHIP.md` 与 `docs/parallel/INTEGRATION_ORDER.md` 为准。

## 数据流

```text
CreativeSeed
  ├─ analyzeCreativeSeed → 0—3 个问题
  ├─ generateCharacterFromSeed → CreativeBrief + 单个 CharacterDraft
  └─ generateConcepts → 3 个 ConceptCandidate → expandCharacter

CharacterDraft
  ├─ generateWorldBible → WorldBible
  ├─ generateStoryDraft → StoryDraft
  ├─ checkRules / runQuickDialogueTest / runDialogueTest
  ├─ proposeFieldRevision → Diff → applyConfirmedRevision / undoRevision
  └─ createMaoxiangPack → PlatformPack

任意阶段 ProjectDocument
  └─ autosave / version / JSON / Markdown
```

`ProjectDocument` 允许未完成阶段为 `null` 或空数组，因此生成流程不需要伪造占位对象。字段定义和导出信封见 [数据格式](DATA_FORMAT.md)。

## 模型调用边界

所有生成模块依赖统一 `LLMClient`：

```js
completeJson({ task, messages, temperature, maxTokens, signal? })
completeText({ task, messages, temperature, maxTokens, signal? })
```

结构化结果必须是原始 JSON，并在使用前通过对应运行时合同或模块级严格校验。空值、解析失败或结构错误最多重试一次。生产代码不得把完整项目、历史、平台包或无关上下文发送给单字段编辑任务。

角色与项目 ID、`createdAt`、`updatedAt` 等应用元数据由本地生成。API Key 只存在于本地 Vite 代理进程的环境变量中。

## 变更、失效与撤销

`invalidateProject(project, changeType)` 返回深拷贝，不修改输入。失效方向固定向下游传播：

| 变化 | 失效内容摘要 |
| --- | --- |
| seed | 简报之后的全部生成物 |
| brief | 候选、角色、世界、故事、评估与平台包 |
| character | 故事、评估与平台包；保留世界设定 |
| world | 故事与平台包 |
| story | 平台包 |

确认字段修改和撤销都按 `character` 变化处理。撤销只恢复字段旧值，不恢复已经失效且可能过期的下游产物。

## 并发与取消

`createTaskRunner()` 为每个 `taskId` 维护一个 `AbortController`：

- 同名任务运行时拒绝重复提交。
- `cancel()` 或 `cancelAll()` 会让公开 Promise 以 `AbortError` 结束。
- 即使底层传输忽略取消并迟到返回，任务运行器也不会把该值解析为成功结果。

调用方只应在任务 Promise 成功后提交项目状态。取消后的状态隔离由集成测试覆盖。

## 持久化边界

存储层只接受通过 `assertProjectDocument` 的对象。自动保存负责防抖和同项目串行写入；显式版本与普通保存分开。导入顺序固定为解析、纯迁移、完整校验、生成新本地 ID、写入 IndexedDB，避免无效或未来版本数据污染数据库。

## 验证层次

1. `npm test`：合同、模块与跨模块 Node 测试。
2. `npm run smoke`：barrel、Vite SSR、Mock 业务链路与浏览器模块兼容性。
3. `npm run build`：生产 bundle 可构建性。
4. GitHub Actions：Node 20 与 Node 22 的干净安装重复验证。

测试目录和本地开发流程见 [开发文档](DEVELOPMENT.md)。
