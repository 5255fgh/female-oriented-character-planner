# 猫箱规则核验清单

生产规则唯一来源是 `src/platforms/maoxiang/rules.js`。长度按 Unicode 码点计算；未经真实页面确认的上限保持 `maxLength: null`，不会触发超限、压缩或复制阻断。

## 已确认

| 入口与字段 | 规则 | 证据状态 |
| --- | --- | --- |
| `free_character.characterPrompt` | 最大 1000 字 | 规格记录实机截图确认，截图与日期未入库 |
| `dead_rival.rivalSetting` | 最大 300 字 | 规格标记已确认，日期未入库 |
| `image_shape.styleSuggestion` | `通用`、`像素画`、`言情漫画`、`细腻厚涂` | 规格锁定枚举，日期未入库 |
| `editor_open_story.storyPrompt` | 最大 10000 字 | 规格已有记录，日期未入库 |

## 待真实页面确认

以下字段只执行类型、必填和已确认枚举校验；长度上限均保持 `null`：

- `editor_character`：`roleName`、`roleIntroduction`、`roleSetting`、`sceneSetting`、`openingMessage`、`dialogueExamples`、`imagePrompt`、`voiceSuggestion`。
- `dead_rival`：`history`、`other`；`other` 可为空。
- `image_shape`：`imagePrompt`。
- `editor_open_story`：`storyTitle`、`mainCharacters`、`storyFoundation`、`storyContent`、`openingMessage`、`chapterOutline`。

界面统一显示“平台上限尚未核验”，按中性状态处理。补充真实页面证据时，同时更新规则来源、复核日期和本清单。
