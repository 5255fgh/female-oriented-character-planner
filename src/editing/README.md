# Editing Module

本目录提供不自动应用的单字段修改提案、轻量 Diff、确认、最多 20 条历史与撤销核心。

公共入口为 `index.js`。角色修改统一返回新的 `ProjectDocument`，并失效旧故事、规则报告、八场景报告和平台包；调用方负责把确认后的 `historyEntry` 通过 `appendRevisionHistory` 加入 UI 状态。
