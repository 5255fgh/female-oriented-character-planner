# 开发、测试与 CI

## 环境

- Node.js `20.19+` 或 `22.12+`。
- npm。
- 不需要全局测试框架；测试使用 Node 内置 `node:test`。

干净安装：

```sh
npm ci
```

本地开发：

```sh
npm run dev
```

局域网调试使用 `npm run dev:lan`，仅限可信网络。

## 验证命令

| 命令 | 目的 |
| --- | --- |
| `npm test` | 串行执行所有 `*.test.js` 与 `*.test.mjs` |
| `npm run smoke` | 验证合同、barrel、Mock、Vite SSR 与核心业务链路 |
| `npm run build` | 生成生产 bundle 并检查模块解析 |

完整提交门槛：

```sh
npm test
npm run smoke
npm run build
git diff --check
```

测试固定 `--test-concurrency=1`，因为多个测试通过 Vite SSR 加载 `?raw` 提示词；串行运行可避免开发服务器的 WebSocket 端口争用，同时保持每个测试文件自身的隔离。

## 测试目录

```text
tests/
  contracts/             合同边界与 Prompt fixture
  generation/            seed、默认单角色与三方向
  world-story-platform/  世界、故事与五种平台包
  evaluation/            快速评估与规则检查
  editing/               字段提案、Diff、确认与 Undo
  storage/               任意阶段保存、自动保存、版本与迁移
  integration/           取消隔离、完整评估与核心 Mock 流程
  ui/                    正式页面渲染、复制门槛与交互状态
```

新增测试应遵循以下原则：

- 从公开 barrel 导入跨模块 API。
- 验证字段、数量和可观察行为，不逐字快照完整提示词或模型文案。
- 需要 `?raw` 导入时使用 Vite SSR fixture，并在 `after` 中关闭服务器。
- 测试不得访问真实模型、真实 IndexedDB 或网络。
- 生产缺陷超出 QA 文件所有权时写入 `docs/handoffs/qa-ci-docs.md`，不要跨模块修复。

## Prompt fixture

`tests/contracts/prompt-fixtures.mjs` 为每个提示词声明唯一版本和最低结构断言。测试会检查：

- 所有 `prompts/*.md` 都在清单中。
- 输出被约束为原始 JSON，并存在任务结构字段。
- 不要求 Markdown、多 Agent 审查或无限重试。
- 模型不应生成应用管理的 ID 与时间戳。
- 运行时请求应携带与 fixture 一致的版本标识。

所有生产提示词消费者都携带 fixture 声明的稳定版本；模型不再生成问题 ID、候选 ID、角色 ID 或时间戳。当前没有登记中的运行时版本或应用元数据缺口，相关断言全部以普通测试运行，出现新缺口会直接失败。

## GitHub Actions

工作流名称为 `CI`，检查名称为：

- `CI / Node 20 verification`
- `CI / Node 22 verification`

PR 和 push 到 `integration/intelligent-v2`、`main` 都触发。工作流没有路径过滤，每个矩阵任务依次执行 `npm ci`、`npm test`、`npm run smoke` 和 `npm run build`。

## 分支与所有权

功能分支从最新 `integration/intelligent-v2` 创建，并以该分支为 PR 目标。路径所有权以 `docs/parallel/MODULE_OWNERSHIP.md` 为准；不要修改其他并行任务的生产文件。

共享公开入口固定为：

- `src/contracts.js`
- `src/generation/index.js`
- `src/evaluation/index.js`
- `src/editing/index.js`
- `src/platforms/maoxiang/index.js`
- `src/storage/index.js`
- `src/workflow/index.js`
- `src/mock/index.js`

不要新增平行合同、重命名公开字段或在 UI 复制核心规则。

## 本地模型配置

真实模型配置只写入被 Git 忽略的 `.env.local`：

```dotenv
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=
VITE_LLM_MODEL=deepseek-v4-flash
```

禁止把密钥写入 `VITE_` 变量、源码、测试 fixture、IndexedDB 或 localStorage。测试和 CI 必须在没有 `LLM_API_KEY` 时正常运行。
