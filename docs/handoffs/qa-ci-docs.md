# QA CI Docs Handoff

## Implemented

- 新增统一 `npm test` 入口，使用 Node 内置测试运行器并固定串行执行，消除并发 Vite SSR fixture 的端口争用。
- 新增合同边界、Prompt fixture、完整八场景评估、取消后迟到结果隔离测试。
- 保留并统一运行第一波各模块已有测试，形成从 seed 到保存、导出、导入的跨模块验证矩阵。
- 新增 GitHub Actions `CI`，在 Node 20 与 Node 22 上执行干净安装、测试、smoke 和构建。
- 更新 README，并新增架构、数据格式、猫箱规则和开发文档。
- 未修改 UI 或其他生产模块；发现的生产缺陷记录在本交接的共享变更请求中。

## Public API

- 未新增或修改生产 API。
- 新增测试脚本：`npm test` → `node --test --test-concurrency=1`。
- 新增 CI 检查：`CI / Node 20 verification`、`CI / Node 22 verification`。

## Test Matrix

| # | 必测能力 | 覆盖位置 | 关键断言 |
| --- | --- | --- | --- |
| 1 | CreativeSeed | `tests/contracts/contract-boundaries.test.mjs` | 只接受非空 `text`，拒绝合同外字段 |
| 2 | 追问最多 3 个 | `tests/generation/character-intelligence.test.mjs` | 0—3 问、每题 3—5 项、推荐值来自选项 |
| 3 | 默认单角色生成 | `tests/generation/character-intelligence.test.mjs` | 跳过答案仍只返回一个完整角色 |
| 4 | 三方向生成 | `tests/generation/character-intelligence.test.mjs` | 兼容 API 正好 3 个候选 |
| 5 | WorldBible 上限 | `tests/contracts/contract-boundaries.test.mjs`、`tests/world-story-platform/world-story-platform.test.mjs` | 规则 8、地点 5、势力 4 的硬上限与单次重试 |
| 6 | StoryDraft 正好 8 节点 | 同上 | 少于 8 拒绝，生成结果正好 8 |
| 7 | 快速 3 场景 | `tests/evaluation/quick-evaluation.test.js` | 固定 3 场景、证据与建议路径有效 |
| 8 | 完整 8 场景 | `tests/integration/full-dialogue.test.mjs` | 一次请求、8 个唯一固定场景、合同通过 |
| 9 | 字段修改只改目标字段 | `tests/editing/revision-core.test.js` | 输入不变、目标字段和时间更新、保留旧检查与平台包 |
| 10 | Diff 和 Undo | `tests/editing/revision-core.test.js` | 文本/数组/替换 Diff 稳定，撤销恢复旧值 |
| 11 | ProjectDocument 任意阶段保存 | `tests/storage/repository.test.mjs` | seed、角色、故事和完整阶段均可往返 |
| 12 | 自动保存 flush | `tests/storage/autosave.test.mjs` | 防抖、立即 flush、串行写入与卸载尽力提交 |
| 13 | 旧 JSON 迁移 | `tests/storage/migrations.test.mjs`、`tests/storage/repository.test.mjs` | 裸旧项目、v1、数据库 v1→v2 与未知高版本 |
| 14 | 平台必填和长度 | `tests/world-story-platform/world-story-platform.test.mjs` | 必填、Unicode、已知/未知上限与枚举 |
| 15 | 五种平台输出包 | 同上 | 五个启用 flowId 的完整字段和合同 |
| 16 | 请求取消不污染项目 | `tests/integration/cancellation.test.mjs` | `AbortError` 后迟到结果不提交，源项目不变 |
| 17 | 核心端到端 Mock 流程 | `tests/integration/core-flow.test.mjs` | seed→角色→世界→故事→评估→平台包→保存→导出→导入 |

Prompt fixture 由 `tests/contracts/prompt-fixtures.mjs` 和对应测试覆盖，不做逐字快照。当前检查包括清单与版本、原始 JSON、输出结构、禁止 Markdown、多 Agent 审查、无限重试和模型应用元数据。

## CI

- 工作流：`.github/workflows/ci.yml`，显示名称 `CI`。
- 检查：`CI / Node 20 verification`、`CI / Node 22 verification`。
- 触发：PR 和 push 到 `integration/intelligent-v2`、`main`。
- 无路径过滤。
- 每个矩阵任务顺序：`npm ci` → `npm test` → `npm run smoke` → `npm run build`。

## Data Migration

- None. 本任务只测试并记录现有 schema v2、旧裸项目和 v1 迁移行为。

## Verification

- `npm ci` — passed；安装 14 个包，0 vulnerabilities。
- `npm test` — passed；59 tests，57 passed，0 failed，2 todo。
- `npm run smoke` — passed；`Smoke checks passed.`。
- `npm run build` — passed；Vite 7.3.6，55 modules transformed。
- GitHub Actions `CI` run `30693816096` — Node 20 与 Node 22 均 passed。

以上结果是 QA 分支合并前的历史记录。最终集成已关闭两个 `todo`；当前完整测试为 79 项通过、0 失败、0 TODO。

## Integration Notes

- 本分支从 `integration/intelligent-v2` 的 `bc2683147c1edd17efeb9719e9047ba1a13bc5cb` 创建。
- Draft PR：`#6`，目标分支 `integration/intelligent-v2`。
- 最终集成已复查 README，并按正式 UI 的四个首页入口、结果页能力和取消行为更新为可用说明。
- `KNOWN_RUNTIME_VERSION_GAPS` 与 `KNOWN_MODEL_METADATA_GAPS` 已清空；原 `todo` 已转为普通通过测试，缺口清单断言仍保留。
- CI 只使用 Mock 和本地 fixture，不需要 API Key 或真实网络模型。

## Requested Shared Change

1. 已解决：以下八个生产提示词消费者均已把 fixture 声明的版本写入运行时请求：
   - `concept-generation`
   - `character-expansion`
   - `field-regeneration`
   - `world-generation`
   - `story-generation`
   - `quick-dialogue-test`
   - `dialogue-evaluation`
   - `maoxiang-pack`

   最终集成已补齐稳定版本标识，所有运行时请求均可追踪到唯一 fixture 版本。

2. 已解决：`prompts/character-expansion.md` 不再要求模型返回 `meta.id`、`meta.createdAt`、`meta.updatedAt`；问题 ID、候选 ID、角色 ID 与时间戳全部由本地代码生成。

上述文件不在 QA Docs 所有权内，因此本任务未跨模块修改。

## Real Open Issues

- 已确认猫箱规则的原始截图、可审计链接和复核日期仍未入库，`verifiedAt` 只能保持 `null`。
