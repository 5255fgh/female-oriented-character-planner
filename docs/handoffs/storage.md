# Storage Handoff

## Implemented

- `ProjectDocument` 可在 seed、brief、character、world/story 或完整阶段保存；写入前、数据库读取后和返回前均执行共享契约校验与深拷贝。
- 自动保存采用每项目 1000ms 默认防抖（允许 800—1500ms）、同项目串行写入、最后待保存值覆盖、状态回调，以及 `pagehide` / `beforeunload` 尽力 `flush`。
- 普通 `saveProject`（包括自动保存）不生成历史；显式历史最多保留 20 个，恢复历史会原子写回项目并生成新的恢复版本。
- JSON 导出改为 schema v2 信封；导入支持旧裸 `CharacterProject`、v1 信封和 v2 信封，迁移及完整校验成功后才打开数据库，并为导入项目生成新 ID。
- 存储对象只接受严格 `ProjectDocument` 字段；API Key、模型请求正文、内部推理等契约外字段会在打开 IndexedDB 前被拒绝。

## Public API

- `saveProject(project) => Promise<ProjectDocument>`：校验并保存项目，刷新 `updatedAt`，不生成历史。
- `getProject(id) => Promise<ProjectDocument | null>`
- `listProjects() => Promise<ProjectDocument[]>`
- `deleteProject(id) => Promise<void>`
- `saveVersion(projectId, snapshot) => Promise<VersionRecord>`
- `listVersions(projectId) => Promise<VersionRecord[]>`
- `restoreVersion(projectId, versionId) => Promise<ProjectDocument>`
- `exportProjectJson(projectId) => Promise<string>`
- `exportProjectMarkdown(projectId) => Promise<string>`
- `importProjectJson(fileContent) => Promise<ProjectDocument>`
- `createAutosaveService({ delay?, save?, onStatus?, eventTarget? }) => { schedule, flush, cancel }`
  - `onStatus` 接收 `{ status, projectId, error? }`；`status` 为 `pending | saving | saved | error | cancelled`。
- `migrateProjectJson(parsedValue) => V2ProjectEnvelope`：纯函数，不访问数据库、不读取当前时间、不生成 ID。
- `migrateStoredProject(value) => ProjectDocument`：供数据库升级复用的纯迁移函数。

## Data Migration

- IndexedDB 数据库版本：`1 → 2`。
- 保留 `projects` 与 `versions` Object Store，不删除旧记录。
- 保留既有索引：`projects.updatedAt`、`versions.projectId`、`versions.createdAt`。
- 新增 `versions.projectIdCreatedAt` 复合索引，key path 为 `["projectId", "createdAt"]`。
- v1 升级时把 `projects` 中旧 `CharacterProject` 和 `versions.snapshot` 补齐为 `ProjectDocument`；任一旧记录无效会中止整个升级事务。
- 新 JSON 信封固定为 `{ schemaVersion: 2, appVersion: "0.2.0", exportedAt, project }`。
- v1 信封可包含旧 `CharacterProject` 或已成形的 `ProjectDocument`；旧裸 JSON 只按 `CharacterProject` 迁移。高于 2 的 schemaVersion 明确拒绝。

## Verification

- `node --test --test-isolation=none tests/storage/*.test.mjs` — 21 tests passed。
- `npm run smoke` — passed。
- `npm run build` — passed（Vite 7.3.6，50 modules transformed）。

## Integration Notes

- UI 初始化一次 `createAutosaveService({ onStatus })`，普通表单变化调用 `schedule(project)`；切换项目、显式保存或离开流程前 `await flush()`；放弃未提交变化时调用 `cancel()`。
- `saveProject` 不创建历史。首次完整角色生成、首次完整故事生成、用户确认 AI 字段修改、用户确认自动修复和手动保存完成后，由调用方对已保存快照调用 `saveVersion(project.id, snapshot)`。不要在普通表单自动保存路径调用 `saveVersion`。
- `restoreVersion` 已同时写回项目并创建新历史，不要在 UI 侧重复调用 `saveVersion`。
- `blocked` 会拒绝并提示关闭其他页面；已打开连接收到 `versionchange` 时会立即关闭，以便其他页面完成升级。
- JSON 导入顺序固定为：解析 → 纯迁移 → 契约校验 → 新 ID/时间 → 写数据库；调用方可直接显示迁移或未知版本错误。

## Requested Shared Change

- None.

## Real Open Issues

- None.
