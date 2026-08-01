# Evaluation Editing 交接

## 公开 API

评估入口：

```js
import {
  checkRules,
  runDialogueTest,
  runQuickDialogueTest,
} from "src/evaluation/index.js";
```

- `checkRules(character) => RuleCheckReport`
  - 对合法 `CharacterDraft` 运行确定性必填检查与有限启发式提醒。
  - 缺失字段、类型错误和契约外结构返回 `status: "fail"`、`severity: "error"`，不再让契约异常越过报告层。
  - 依附型目标、低主动性、套话和同质化等观察只返回 `warning`，措辞明确标注有限关键词、字符或片段启发式。
- `runQuickDialogueTest(character, llmClient, options?) => Promise<QuickDialogueReport>`
  - `options` 当前只允许 `{ signal?: AbortSignal }`。
  - 固定且按顺序返回 `refusal`、`motive_question`、`out_of_character_request` 三个场景。
  - 本地校验非空输入/回复、证据逐字引用当前回复、建议字段路径真实存在，并在模型结构错误时最多重试一次。
  - `warning` 正常返回，不阻断角色继续使用。
- `runDialogueTest(character, llmClient)` 保持原有正好 8 场景的 `SimulationReport` 行为，没有被三场景快速测试替换。

`QuickDialogueReport` 形状为：

```js
{
  status: "pass" | "warning" | "fail",
  scenarios: Array<{
    scenarioId: string,
    userInput: string,
    characterResponse: string,
    issues: string[],
    evidence: string[],
    suggestedFields: string[]
  }>, // 正好 3 项
  summary: string
}
```

编辑入口：

```js
import {
  appendRevisionHistory,
  applyConfirmedRevision,
  createRevisionDiff,
  getRuleIssueId,
  proposeFieldRevision,
  proposeRuleFixes,
  undoRevision,
} from "src/editing/index.js";
```

- `proposeFieldRevision(project, fieldPath, instruction, context, llmClient, options?)`
  - 输入必须是有效 `ProjectDocument` 且已有 `character`。
  - 返回且只返回 `{ fieldPath, before, after, summary }`。
  - 只把目标值、少量角色一致性锚点和调用方给出的 `context` 发给模型；不发送项目、故事、平台包或完整角色。
  - 校验路径存在、`before` 等于当前值、`after` 确实变化，并把 `after` 临时应用到角色副本后用 `assertCharacterDraft` 校验字段类型和结构。
  - 不允许提案修改应用管理的 `meta`、`meta.id`、`meta.createdAt` 或 `meta.updatedAt`。
  - 不修改或自动应用输入项目；模型结构错误最多重试一次。
- `createRevisionDiff(before, after)`
  - 返回 `{ kind, changed, replacement, changes }`。
  - `kind` 为 `unchanged | text | array | json | replace`；`changes` 使用稳定顺序的 `equal | remove | add | replace` 操作。
  - 文本按 Unicode 码点保留公共前后文；数组使用轻量 LCS 展示项目增加和删除；根值类型不同或没有共享结构时 `replacement: true`。
- `applyConfirmedRevision(project, revision)`
  - 返回 `{ project, historyEntry }`；`historyEntry` 固定为 `{ fieldPath, before, after, appliedAt }`。
  - 输入项目不原地变化；提案过期（当前值不再等于 `before`）时拒绝应用。
- `appendRevisionHistory(history, historyEntry)` 返回新数组并只保留最近 20 条。
- `undoRevision(project, history)` 返回 `{ project, history }`，恢复最近条目的 `before` 并弹出该历史；当前值不再等于该条目的 `after` 时拒绝错误撤销。
- `getRuleIssueId(issue, index)` 为共享契约里没有 `id` 的规则问题生成本次报告内稳定标识。
- `proposeRuleFixes(project, selectedIssueIds, llmClient, options?)` 只对显式选择的问题各生成一项独立 revision；不应用、不重新运行检查，也不循环优化。每项仍须单独交给 `applyConfirmedRevision` 确认。

## 失效规则

确认修改与撤销都按 `character` 变更处理：

- 更新 `character.meta.updatedAt` 和 `project.updatedAt`。
- 清空依赖该角色的 `storyDraft`。
- 保留 `ruleReport`、`simulationReport` 和 `platformPacks` 供对照，UI 标记为“可能已过期”。
- 保留 `worldBible`、简报、候选、生成记录和其他非下游项目数据。
- 撤销只恢复字段旧值；旧检查和平台包继续保留。

## UI / Workflow 所需状态

UI 接线时建议维护以下瞬时状态，不写入共享 `ProjectDocument`：

```js
{
  quickDialogueReport: QuickDialogueReport | null,
  pendingRevision: FieldRevision | null,
  revisionDiff: RevisionDiff | null,
  revisionHistory: RevisionHistoryEntry[], // 使用 appendRevisionHistory，最多 20 条
  selectedRuleIssueIds: string[]
}
```

建议流程：角色生成或确认修改后立即运行 `checkRules(character)`；需要模型的轻量自动检查时再运行 `runQuickDialogueTest`。完整评估入口仍运行 `runDialogueTest` 并写入项目的八场景 `simulationReport`。三场景快速报告不得写入 `simulationReport`，因为共享契约明确要求该字段正好 8 场景。

确认按钮调用 `applyConfirmedRevision`，然后用 `appendRevisionHistory` 保存返回的 `historyEntry`；取消按钮只丢弃 `pendingRevision`。撤销按钮调用 `undoRevision`。自动规则修复返回的每个提案也进入相同确认流程。

## 测试结果

本模块覆盖：

- 快速测试正好 3 场景、固定顺序、有效证据和建议字段。
- `warning` 非阻断，以及确定性结构错误为阻断报告。
- 提案不修改源项目、不发送完整无关上下文、返回值类型校验与单次重试。
- 只修改目标字段、稳定文本/数组 Diff、撤销恢复、20 条历史上限。
- 角色变更后故事失效，旧评估和平台包保留供对照。
- 规则修复只处理显式选择项且不循环。
- 原有 8 场景流程由现有 smoke 继续验证。

执行命令：

```text
node --test --test-concurrency=1 tests/evaluation/quick-evaluation.test.js tests/editing/revision-core.test.js
npm run build
npm run smoke
```

## 共享契约请求

当前实现不要求修改 `src/contracts.js` 或 `src/contracts/**`。`QuickDialogueReport` 刻意保持为瞬时模块类型，以免放宽 `SimulationReport` 的正好 8 场景约束。若最终集成确实需要持久化三场景报告，应由 final-integration 明确新增独立字段与校验；不得复用或放宽现有 `simulationReport`。
