# Module Ownership

本文件是并行开发文件所有权的唯一清单。除集成任务外，每个任务只修改自己的路径；共享契约变更写入交接文件的 `Requested shared change`。

| 模块 | 独占路径 | 责任边界 |
| --- | --- | --- |
| Storage | `src/storage/**`、`tests/storage/**`、`docs/handoffs/storage.md` | 任意阶段项目保存、自动保存、迁移、版本和导入导出 |
| Character Intelligence | 角色相关 `src/generation/**`、角色提示词、`tests/generation/**`、`docs/handoffs/character-intelligence.md` | seed 分析、简报与角色生成、字段上下文、三方向兼容 |
| World Story Platform | 世界/故事生成文件、`src/platforms/maoxiang/**`、对应提示词、`tests/world-story-platform/**`、`docs/handoffs/world-story-platform.md` | WorldBible、StoryDraft、猫箱规则与适配器 |
| Evaluation Editing | `src/evaluation/**`、`src/editing/**`、`tests/evaluation-editing/**`、`docs/handoffs/evaluation-editing.md` | 快速/完整评估、字段提案、Diff、确认与撤销 |
| UI Workflow | `src/app.js`、`src/app-state.js`、`src/ui/**`、`src/styles.css`、`index.html`、`tests/ui/**`、`docs/handoffs/ui-workflow.md` | 页面流程、顶层接线、渲染与交互；不复制核心逻辑 |
| QA Docs | `tests/**` 中未被模块占用的集成测试、`.github/**`、最终 `README.md`、最终公共文档、`docs/handoffs/qa-ci-docs.md` | 架构/集成验证、CI、最终用户文档 |
| Foundation / Integration | `src/contracts.js`、`src/contracts/**`、共享 `src/workflow/**`、根配置、`scripts/smoke*`、`docs/parallel/**` | 共享契约、barrel、跨模块失效与任务边界 |

`src/mock/**` 只允许各模块新增或修改与自己任务名直接相关的文件；现有共享 mock 需要修改时必须保持其他任务行为并在交接中注明。每个模块可写自己的 `docs/handoffs/<module>.md`，这不构成对 QA Docs 公共文档所有权的越界。
