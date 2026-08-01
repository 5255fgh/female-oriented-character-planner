# World Story Platform Handoff

## Implemented

- 实现共享 `WorldBible` 生成：规则最多 8 条、地点最多 5 个、势力最多 4 个，并分离 `canonFacts` / `forbiddenFacts`。
- 实现开放 `StoryDraft` 生成：支持角色、`seed + worldBible` 与既有故事主要角色输入，固定 8 个关键节点，并限制分支、伏笔和状态变量。
- 实现五种声明式猫箱适配：`editor_character`、`free_character`、`dead_rival`、`image_shape`、`editor_open_story`。
- 将必填、Unicode 长度、枚举、验证状态和证据集中到 `src/platforms/maoxiang/rules.js`，旧 `MAOXIANG_FLOWS` 由该注册表派生。
- 已知超限字段每个输入包只发起一次统一压缩请求；仍超限或压缩响应无效时保留全文并返回 `valid: false`，不硬截断。
- 新增模块专用稳定 mock；未接管或覆盖共享 mock 的其他任务。

## Public API

- `generateWorldBible(context, llmClient, options) => Promise<WorldBible>`
- `generateStoryDraft(context, llmClient, options) => Promise<StoryDraft>`
- `createMaoxiangPack(project, flowId, llmClient, options) => Promise<PlatformPack>`
- `generateMaoxiangPack(character, flowId, llmClient) => Promise<PlatformPack>`（兼容旧三入口）
- `adaptMaoxiangFields(project, flowId) => Record<string, string>`
- `validateMaoxiangFields(flowId, fieldValues) => PlatformBlock[]`
- `validatePlatformPack(pack) => PlatformPack`
- `createWorldStoryPlatformMockLLMClient() => LLMClient`

## Data Migration

- None.

## Verification

- `node --test tests/world-story-platform/*.test.mjs` — 7 tests passed.
- `npm run smoke` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.

## Integration Notes

- 分支基于 `origin/integration/intelligent-v2` 的 `b1ea478d67d9a4a7313129e5565fd60dc0c80518`。
- 规则来源：`free_character.characterPrompt = 1000`、`dead_rival.rivalSetting = 300`、四项图像风格枚举及 `storyPrompt = 10000` 均来自 `PROJECT_SPEC.md` 第 4 节；仓库未记录复核日期，因此 `verifiedAt` 如实保持 `null`。
- 待真实页面确认的字段统一记录在 `docs/MAOXIANG_RULES.md`；对应 `maxLength` 均保持 `null`。
- UI 生成项目输入包时调用 `createMaoxiangPack(project, flowId, llmClient, options)`；手工编辑后只调用 `validatePlatformPack` 重新计算状态，不应在 UI 重复实现必填或枚举判断。
- `createWorldStoryPlatformMockLLMClient` 委托共享 mock 处理旧任务，只增加 `world-generation`、`story-generation` 和 `maoxiang-compress-fields`。
- 旧 `open_story` 配置作为禁用兼容项保留；新的开放故事适配 flowId 是 `editor_open_story`。

## Requested Shared Change

- 已由 Wave 1 Integration 完成：共享 `PLATFORM_FLOW_IDS` 已增加 `editor_character` 与 `editor_open_story`，`assertPlatformPack`、`assertProjectDocument` 与 Storage 均可校验和保存这两类输入包；旧 `open_story` 仅为旧项目兼容保留。
- 已由 Wave 1 Integration 完成：`src/ui/actions/generation-actions.js` 已删除重复必填判断，手工编辑统一依赖 `validatePlatformPack`。

## Real Open Issues

- 已确认规则的原始截图/复核日期不在当前仓库中，不能安全填写非空 `verifiedAt`。
