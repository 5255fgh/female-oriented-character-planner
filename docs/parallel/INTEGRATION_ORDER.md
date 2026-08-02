# Integration Order

所有功能分支从最新 `integration/intelligent-v2` 创建，所有功能 PR 也以该分支为目标；不得直接向 `main` 提交功能 PR。

## Wave 0

1. `integration/intelligent-v2`：模块化基座、共享契约和边界文档。

## Wave 1

以下分支可并行开发，但合并任务按固定顺序逐个合入，并在每次合并后运行相关测试：

1. `feat/v2-storage`
2. `feat/v2-character-intelligence`
3. `feat/v2-world-story-platform`
4. `feat/v2-evaluation-editing`

Wave 1 合并任务统一处理交接文件中的共享契约请求，并建立不依赖 UI 的核心端到端测试。

## Wave 2

Wave 1 全部合并并验证后再创建：

1. `feat/v2-ui-workflow`
2. `test/v2-qa-ci-docs`

两项可以并行开发；最终集成先合 UI，再合 QA/文档，以最终实现为准修正文档和测试。

## Final Integration

1. 每次合并后运行 `npm run smoke` 与 `npm run build`。
2. 处理共享契约请求，删除失效兼容代码，验证完整 Mock 用户流程。
3. 从 `integration/intelligent-v2` 向 `main` 创建最终 PR。
