# 数据格式与迁移

## 权威来源

运行时字段与校验以 `src/contracts.js` 和 `src/contracts/` 为准。本文说明持久化与交换格式，不复制完整角色字段清单，也不放宽合同。

## ProjectDocument

`ProjectDocument` 是当前项目的持久化根对象，可以在任意生成阶段保存：

```text
id: string
title: string
seed: CreativeSeed | null
brief: CreativeBrief | null
concepts: ConceptCandidate[]          // 空数组或正好 3 项
selectedConceptId: string | null
character: CharacterDraft | null
worldBible: WorldBible | null
storyDraft: StoryDraft | null
ruleReport: RuleCheckReport | null
simulationReport: SimulationReport | null
platformPacks: PlatformPack[]
generationRecords: GenerationRecord[]
createdAt: string
updatedAt: string
```

未生成的单值字段使用 `null`，集合使用空数组。`selectedConceptId` 非空时必须指向 `concepts` 中已有候选。完整评估的 `simulationReport.scenarios` 必须正好 8 项；快速 3 场景报告是瞬时结果，不能写入该字段。

`GenerationRecord` 只记录任务、目标、状态和创建时间：

```text
id: string
task: string
target: string
status: "completed" | "cancelled" | "failed"
createdAt: string
```

不得在项目中加入 API Key、模型请求正文、内部推理、Cookie 或任意合同外字段。

## 主要嵌套对象

- `CreativeSeed`：严格的 `{ text: string }`，`text` 去除空白后必须非空。
- `CreativeBrief`：角色目标、关系、边界和输出模式的结构化输入。
- `CharacterDraft`：公开信息、人格、关系、对话、开场与形象设计。
- `WorldBible`：世界摘要、规则、地点、势力、既定事实与禁止事实。
- `StoryDraft`：开放故事前提、开场、正好 8 个节点及有限分支信息。
- `PlatformPack`：某个猫箱入口的字段块及长度验证结果。

数量上限和字段类型由运行时合同强制执行，调用方不得自行放宽。

## JSON 导出信封

当前导出格式是 schema v2：

```json
{
  "schemaVersion": 2,
  "appVersion": "0.2.0",
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "project": {}
}
```

`project` 必须是完整有效的 `ProjectDocument`。`exportedAt` 是 ISO 时间字符串；导入后会为项目生成新的本地 `id`、`createdAt` 与 `updatedAt`，避免覆盖已有项目。

## 兼容与迁移

当前迁移器接受：

| 输入 | 处理 |
| --- | --- |
| 旧裸 `CharacterProject` | 补齐 v2 阶段字段，包装为 v2 信封 |
| schema v1 信封 | 迁移其中的旧项目或已成形项目 |
| schema v2 信封 | 严格校验后深拷贝 |
| 高于 v2 的信封 | 明确拒绝，避免错误降级 |

迁移是纯函数：不读当前时间、不生成 ID、不访问数据库，也不修改输入。导入只有在解析、迁移和合同校验全部成功后才打开数据库。

IndexedDB 当前数据库版本为 2。升级保留 `projects` 与 `versions`，并迁移旧项目和版本快照；任一记录无效会中止升级事务。

## 版本与自动保存

- 普通 `saveProject` 和自动保存不会自动创建历史版本。
- `saveVersion` 用于用户明确确认的重要节点，最多保留最近 20 个版本。
- `restoreVersion` 原子写回项目，并为恢复后的状态创建一个新版本。
- 自动保存同一项目严格串行，较旧写入不能覆盖较新待保存值。

## Markdown 导出

Markdown 是只读归档格式，按项目阶段显示已生成内容和“未生成”状态。它不包含可可靠还原所有运行时类型的迁移信封，因此不能替代 JSON 备份。

## 字符计数

平台字段长度统一使用 `Array.from(text).length` 按 Unicode 码点计数，而不是 JavaScript 字符串的 UTF-16 `length`。平台字段规则见 [猫箱规则文档](MAOXIANG_RULES.md)。
