# 猫箱规则与验证状态

## 规则原则

`src/platforms/maoxiang/rules.js` 是平台字段规则的唯一生产来源。每个字段明确记录：

- 是否必填。
- 已知最大长度或 `null`。
- 允许值枚举或 `null`。
- 是否已有仓库证据支持。
- 复核日期与证据说明。

未知上限必须保持 `null`，不会被猜测值替代。所有长度用 Unicode 码点计数。

## 入口状态

| flowId | 状态 | 数据来源 |
| --- | --- | --- |
| `editor_character` | 启用 | `ProjectDocument.character`，可选使用 `worldBible` |
| `free_character` | 启用 | `ProjectDocument.character` |
| `dead_rival` | 启用 | `ProjectDocument.character` |
| `image_shape` | 启用 | `ProjectDocument.character.imageDesign` |
| `editor_open_story` | 启用 | `ProjectDocument.storyDraft`，可选使用 `worldBible` |
| `open_story` | 禁用，仅旧数据兼容 | 不允许新项目生成 |

适配器只生成可复制的文本字段；项目不会自动登录、填写或发布到猫箱。

## 已确认规则

| 入口与字段 | 必填 | 规则 | verified | 证据状态 |
| --- | --- | --- | --- | --- |
| `free_character.characterPrompt` | 是 | 最大 1000 字 | `true` | `PROJECT_SPEC.md` 记录实机截图确认，截图日期未入库 |
| `dead_rival.rivalSetting` | 是 | 最大 300 字 | `true` | `PROJECT_SPEC.md` 标记已确认，确认日期未入库 |
| `image_shape.styleSuggestion` | 是 | `通用`、`像素画`、`言情漫画`、`细腻厚涂` | `true` | `PROJECT_SPEC.md` 锁定枚举，复核日期未入库 |
| `editor_open_story.storyPrompt` | 是 | 最大 10000 字 | `true` | 沿用规格中开放故事提示词记录，复核日期未入库 |

旧兼容入口 `open_story.storyPrompt` 使用同一条 10000 字规则，但入口本身禁用。

## 尚未确认长度

以下字段的 `maxLength` 为 `null`、`verified` 为 `false`：

- `editor_character`：`roleName`、`roleIntroduction`、`roleSetting`、`sceneSetting`、`openingMessage`、`dialogueExamples`、`imagePrompt`、`voiceSuggestion`。
- `dead_rival`：`history`、`other`；其中 `other` 可为空，其余字段必填。
- `image_shape`：`imagePrompt`。
- `editor_open_story`：`storyTitle`、`mainCharacters`、`storyFoundation`、`storyContent`、`openingMessage`、`chapterOutline`。

这些字段仍执行类型、字段集合与必填检查，但不会因未经证实的长度而失败。

## PlatformBlock 计算

每个字段转换为：

```text
id: string
label: string
text: string
maxLength: number | null
currentLength: number
valid: boolean
verified: boolean
```

`valid` 同时考虑必填、已知长度和枚举。`currentLength` 必须等于 `Array.from(text).length`。未知长度不参与失败判定；已知超限、空必填或非法枚举会得到 `valid: false`。

## 生成与压缩

`createMaoxiangPack` 先进行声明式适配和统一验证。若存在已知超限字段，会把所有超限字段合并为一次压缩请求：

1. 只允许返回被点名的字段。
2. 每个输入包最多压缩一次。
3. 压缩后重新执行同一规则验证。
4. 若仍超限或响应无效，保留完整文本并标记无效，不硬截断。
5. 未知上限字段不触发自动压缩。

手工修改包内容后应调用 `validatePlatformPack`，不能在 UI 中复制另一套规则。

## 证据缺口

仓库目前没有已确认规则的原始截图、复核日期或可审计链接，因此 `verifiedAt` 如实保持 `null`。补充证据时应更新规则来源和本文件，不得只改界面文案。
