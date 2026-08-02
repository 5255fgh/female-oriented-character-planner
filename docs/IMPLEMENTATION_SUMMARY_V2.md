# v0.2.0 实施总结

## 1. 最终架构

应用采用 Vanilla JavaScript ES Modules 与 Vite。`src/contracts.js` 统一导出严格运行时合同；生成、评估、编辑、猫箱适配、存储、工作流、Mock 和 UI 各自通过公开入口协作。模型只生成当前任务正文，本地代码负责 ID、时间戳、失效规则、取消隔离与持久化。

## 2. 已实现模块

- 一句话 seed 分析、最多 3 个可跳过追问、默认单角色生成和可选三方向探索。
- WorldBible 与正好 8 个关键节点的开放 StoryDraft。
- 确定性规则检查、3 场景快速测试和 8 场景完整测试。
- 单字段 AI 提案、Before/After/Diff、确认与最近修改撤销；旧检查和平台包保留并提示可能已过期。
- 五种猫箱输入包、统一校验、一次压缩尝试和安全复制。
- IndexedDB 自动保存、显式版本、恢复、JSON 导入迁移及 JSON/Markdown 导出。
- 正式响应式 UI、稳定 Mock、真实 OpenAI 兼容客户端和可取消任务。

## 3. 数据格式变化

持久化根对象由只允许完整角色流程的旧 `CharacterProject` 扩展为可保存任意阶段的 `ProjectDocument`，新增 `seed`、`worldBible`、`storyDraft` 与 `generationRecords`，未生成对象使用 `null`、集合使用空数组。JSON 导出采用 `{ schemaVersion: 2, appVersion: "0.2.0", exportedAt, project }`；旧裸项目与 schema v1 可迁移，导入后生成新的本地项目 ID 和时间。

## 4. 猫箱适配

新项目支持 `editor_character`、`free_character`、`dead_rival`、`image_shape` 与 `editor_open_story`；旧 `open_story` 仅用于兼容。规则唯一来源为 `src/platforms/maoxiang/rules.js`。已知规则包括自由角色 1000 字、亡者劲敌设定 300 字、形象风格枚举和开放故事正文 10000 字；未知长度保持 `null`，不会猜测或硬截断。应用只生成并复制文本，不操作猫箱网页。

## 5. 测试与 CI

`npm test` 覆盖合同、提示词、生成、世界与故事、评估、编辑、存储、迁移、取消、UI 渲染及完整 Mock 链路；`npm run smoke` 验证公开入口、Vite SSR 与核心流程；`npm run build` 验证生产 bundle。Playwright 实机验收覆盖角色生成、8 场景测试、字段提案/确认/撤销、刷新恢复、JSON/Markdown 下载、开放故事 8 节点、旧 JSON 迁移与请求取消。GitHub Actions 在 Node 20 与 Node 22 上依次执行 `npm ci`、测试、smoke 和构建。

## 6. 已知限制

真实模型效果取决于本机配置的兼容 API；项目只保存在当前浏览器来源。仓库尚未保存猫箱已确认字段的原始截图、可审计链接或复核日期，其他字段的实际长度上限仍未知。应用不自动登录、填写或发布到猫箱，也未实现 TXT 小说导入。

## 7. 后续唯一建议：TXT 小说提取是否值得实施

先用少量真实小说样本验证“提取角色、世界与开放剧情结构”能否稳定减少人工录入，并明确版权、隐私与超长文本处理边界；只有验证收益明显且合同可保持可审计时，再决定是否实施 TXT 小说提取。
