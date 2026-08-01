# UI Workflow Handoff

## Implemented

- 首页提供创建角色、创建开放故事、打开已有项目和导入 JSON 四个真实入口；没有小说导入空壳。
- 快速输入默认只展示一句话灵感、必须出现、不要出现和生成动作；角色高级简报保持折叠。
- 信息不足时展示最多 3 个可跳过追问，支持单选、简短文本、推荐标记和一键采用推荐。
- 生成过程展示分析灵感、生成角色或故事、可选快速检查和生成平台文本四个阶段，并支持取消状态。
- 角色支持直接生成和 3 个差异化方向选择；开放故事生成共享世界、故事摘要和正好 8 个关键节点。
- 结果页提供角色/故事摘要、错误与提醒分层、3 场景快速测试、完整 8 场景测试入口、证据展开与字段跳转。
- 自动生成 `editor_character` 或 `editor_open_story` 默认平台包，并可分别生成当前项目支持的其他输入包；输入包生成不依赖质量检查。逐字段和整包复制均受平台字段校验结果控制，实时展示 Unicode 字数、已知/未知限制和超限原因，绝不截断正文。
- 角色高级编辑默认折叠，元数据只读；字段 AI 修改先展示 Before / After / Diff，确认后才应用，并可撤销最近一次确认修改。角色修改后旧检查和平台文本保留并标记为“可能已过期”。
- 接入 Storage 的自动保存、草稿恢复、项目列表、手动版本、版本恢复、JSON/Markdown 导出和 JSON 导入；UI 只消费存储服务状态，不重复实现防抖或数据库逻辑。
- 响应式布局已在 320px 和桌面宽度实际查看；移除了根级最小宽度造成的隐藏横向溢出，当前可见交互目标至少 44px，键盘焦点有明确轮廓。

### Page Flow

```text
首页
├─ 创建角色 → 快速输入 → 可选追问 → 直接生成或 3 方向选择
├─ 创建开放故事 → 快速输入 → 可选追问 → 生成故事
├─ 打开已有项目 → 结果或未完成步骤
└─ 导入 JSON → 校验/迁移 → 结果或未完成步骤

生成/选择完成
→ 默认平台文本
→ 可选快速检查
→ 摘要与复制
→ 可选高级编辑
→ 自动保存、版本、导出
```

## Public API

- `src/app-state.js`
  - `createEmptyBrief()`、`createWorkingProject(title)`、`createGenerationProgress()`、`createInitialAppState()`
  - `resetCurrentProject(kind)`、`replaceCurrentProject(project)`、`inferKindFromProject(project)`
- `src/ui/actions/generation-actions.js`
  - `prepareSeedForProject(state, quickInput, advancedBrief)`
  - `analyzeSeedForProject(state, llmClient, signal)`
  - `generatePrimaryContent(state, llmClient, signal)`、`selectConceptForProject(state, concept, llmClient, signal)`
  - `runQuickChecksForProject(state, llmClient, signal)`、`generatePlatformPackForProject(state, llmClient, signal)`
  - `updateCharacterField(state, path, value)`、`editPlatformPack(state, flowId, blockId, text)`
- `src/ui/actions/editing-actions.js`
  - `proposeCharacterRevision(state, fieldPath, instruction, llmClient, signal)`
  - `confirmCharacterRevision(state)`、`discardCharacterRevision(state)`、`undoLastCharacterRevision(state)`
- `src/ui/actions/project-actions.js`
  - `createProjectAutosaveService(options)`、`refreshSavedProjects(state)`、`refreshVersions(state)`
  - `createProject(state, kind)`、`importProjectIntoState(state, fileContent)`
  - `saveProjectCheckpoint(state, options)`、`loadProjectIntoState(state, projectId)`、`deleteProjectFromState(state, projectId)`
  - `restoreProjectVersion(state, versionId)`、`exportSavedProject(state, format)`
- `src/ui/renderers.js`
  - `renderApp(state, { model })`

### UI State

- 路由：`currentStep` 使用 `home | create | questions | progress | concepts | result | storage`。
- 项目：`projectKind`、`generationMode`、`project`、`quickInput`、`advancedBrief`。
- 追问：`questions`、`answers`；渲染和读取均只消费前 3 项。
- 进度：`progress` 固定四阶段，`progressStatus` 记录运行、等待输入/选择、完成、失败或取消。
- 检查：`quickDialogueReport`、`storyCheck`、`selectedRuleIssueIds`、`activeFieldPath`。
- 编辑：`pendingRevision`、`revisionDiff`、`revisionHistory`、`fieldInstructions`。
- 存储：`savedProjects`、`versions`、`recoveryProjectId`、`autosaveStatus`、`autosaveError`、`dirty`。
- 瞬时反馈：`loading`、`pendingAction`、`error`、`notice`。

## Data Migration

- None. JSON 导入迁移完全委托给现有 Storage API。

## Verification

- `node --test tests/ui/ui-workflow-rendering.test.mjs` — 12/12 passed，覆盖快速入口、3 题上限、角色/故事摘要、warning/error 复制规则、Diff、Undo、字段直改展开状态、自动保存状态、取消状态和故事语境追问。
- `npm run build` — passed，Vite 生产构建完成（78 modules transformed）。
- `npm run smoke` — passed，`Smoke checks passed.`
- Playwright CLI（`http://127.0.0.1:4173`）— 角色直接生成、3 方向选择、开放故事、推荐追问、完整 8 场景、字段提案/确认/Undo、草稿恢复均通过。
- Playwright CLI 320px / 1440px — `scrollWidth === clientWidth`、`scrollX === 0`；当前可见交互目标均不小于 44px；Tab 焦点轮廓为 `solid 2.4px`；console 0 errors / 0 warnings。

## Integration Notes

- 基于 `integration/intelligent-v2` 的 `bc26831` 接线，依赖现有 generation、evaluation、editing、platform 和 storage 模块，不复制其核心实现。
- `src/app.js` 只通过 `src/ui/actions/project-actions.js` 使用 Storage，避免顶层入口直接依赖存储内部实现。
- 角色生成后使用 `editor_character`，开放故事使用 `editor_open_story`；平台字段有效性始终以 `validatePlatformPack` 返回结果为准。
- 角色字段确认修改或直接编辑后，旧检查和平台包保留供对照并标记为“可能已过期”；用户可分别按需重新运行或生成。
- UI 取消通过共享 task runner 立即停止状态推进，并在每个异步边界检查 `AbortSignal`，迟到响应不会覆盖项目。

## Requested Shared Change

- 已由最终集成完成：`src/llm/openai-compatible-client.js` 接受核心模块附在请求上的可选 `signal` 并传给 `fetch`；共享可取消客户端同时覆盖 Mock 或忽略信号的传输。

## Real Open Issues

- None.
