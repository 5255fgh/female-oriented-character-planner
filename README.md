# Female-oriented Character Planner

女性向角色策划与猫箱输入包生成器。项目把零散的创作想法整理为可校验、可版本化的角色数据，再转换为猫箱三个已支持入口所需的文本输入包；它不是聊天客户端，也不会自动操作或发布到猫箱。

## 解决的问题

- 用结构化创作简报减少角色设定遗漏。
- 用正好 3 个差异化候选帮助确定角色方向。
- 将完整角色、规则检查和 8 场景模拟放在同一条可复查流程中。
- 按猫箱入口的已知限制检查输入包，同时明确标记未知限制。
- 通过浏览器本地保存、历史版本与 JSON/Markdown 导出降低设定丢失风险。

## 已实现功能

- `CreativeBrief` 表单与严格契约校验。
- 正好 3 个角色概念候选、候选选择与完整 `CharacterDraft` 扩展。
- 单字段定向重生成，只应用返回的 `{ fieldPath, value }` 补丁。
- 确定性规则检查与正好 8 个固定场景的角色模拟。
- `free_character`、`dead_rival`、`image_shape` 三种猫箱输入包。
- 已知字数限制、Unicode 字符计数、允许风格枚举与未知上限提示。
- IndexedDB 项目保存、历史版本恢复、JSON 导入/导出和 Markdown 导出。
- 稳定 Mock 模式，以及通过本地 Vite 代理连接 OpenAI Chat Completions 兼容 API 的真实模式。

## 明确非目标

首版不实现猫箱自动登录或操作、自动发布、批量创建、图片生成、语音、世界书、小说转换、完整聊天前端、用户系统、云同步、多 Agent 或主观 0—100 评分。项目也不会在静态资源或浏览器存储中保存 API Key。

## 技术栈

- Vanilla JavaScript ES Modules
- Vite
- 浏览器 IndexedDB

## 环境要求

- Node.js `20.19+` 或 `22.12+`
- npm
- 支持 ES Modules 与 IndexedDB 的现代浏览器

## 安装

```sh
npm install
```

## Mock 运行与开发

```sh
npm run dev
```

打开终端显示的本地地址。应用默认使用 Mock 模式，无需 API Key；可直接完成候选生成、角色扩展、检查、模拟、输入包和本地保存流程。

## 真实 API 配置

复制示例环境文件为仅本机使用的 `.env.local`：

```sh
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

在 `.env.local` 中配置：

```dotenv
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=你的本地密钥
VITE_LLM_MODEL=deepseek-v4-flash
```

DeepSeek 默认模型为 `deepseek-v4-flash`。重新运行 `npm run dev`，再在页面顶部切换到真实 API 模式。密钥只由本地 Vite 代理读取并注入请求，不会进入客户端 bundle、IndexedDB 或 localStorage。

## 局域网手机运行

```sh
npm run dev:lan
```

确保电脑与手机位于同一局域网，再用手机访问终端显示的局域网地址。此命令会监听 `0.0.0.0`；仅在可信网络中使用。

## 生产构建

```sh
npm run build
```

## 本地预览

```sh
npm run preview
```

纯静态 GitHub Pages 不提供本地 Vite API 代理。因此 Mock 版本可作为静态页面使用；真实 API 版本必须在本地运行，或另行配置不会向浏览器暴露密钥的服务端代理。

## 猫箱三个入口

在“创作简报”的“输出模式”中选择入口，完成候选、角色、规则检查与 8 场景模拟后，在“猫箱输入包”步骤生成并复制文本：

- `free_character`（自由创建角色）：生成 `characterPrompt`，已知上限为 1000 字。
- `dead_rival`（亡者劲敌）：生成 `rivalSetting`、`history` 和 `other`；`rivalSetting` 已知上限为 300 字，后两项上限未知。
- `image_shape`（捏形象）：生成 `imagePrompt` 和 `styleSuggestion`；风格只允许“通用”“像素画”“言情漫画”“细腻厚涂”，图像描述上限未知。

输入包文本可以继续手工编辑。页面会按 Unicode 字符实时重算长度；超限内容只会标记为“需调整”，不会被截断。平台未确认的上限会明确显示为未知。

## 本地数据与备份

项目和历史版本只保存在当前浏览器、当前站点来源的 IndexedDB 中，不会云同步；更换浏览器、域名、端口或清理站点数据后，原数据可能不可见。

完成并保存项目后，可在“保存与导出”中：

- 导出 JSON：保留完整结构，可稍后通过“导入 JSON”恢复为新项目。
- 导出 Markdown：生成便于阅读和人工归档的文本备份。

建议在重要修改后同时保存 JSON 与 Markdown 到受控的备份位置。

## 许可证与参考

本项目使用 [AGPL-3.0](./LICENSE) 许可证。

产品思路可参考 Nika Character Studio、ST-CardGen 和 CardRefinery。本项目不声称复制这些项目的代码；如后续实际引入第三方代码，必须同时保留其适用许可证、版权和署名信息。
