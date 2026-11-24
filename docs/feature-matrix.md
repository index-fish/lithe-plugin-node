# 功能矩阵

两个插件均为声明式（无后端进程）。最近更新：2026-11-24。

## Node.js Support（0.1.7）

| 能力 | 清单声明 | 本机验证 | 说明 |
| --- | --- | --- | --- |
| JS/TS 语法高亮 | 宿主内置 | 是 | 由宿主 TextMate grammar 提供，不算插件能力 |
| JS/TS 补全、跳转、诊断 | 是 | 是 | tsserver 在宿主日志中有 `lsp.startServer` + running 会话证据（`main.action.ts`） |
| npm scripts 构建模型 | 是 | 是 | 本地 fixture 解析出 2 个 target / 2 个 task |
| npm script Run 入口 | 是 | 否 | fromTasks 入口不重复 arguments（已修宿主校验错误） |
| Node 工具发现 | 是 | 部分 | PATH / nvm / fnm 声明完成，宿主端逐项未点验 |
| 设置项（6 项） | 是 | 否 | 声明完成，未逐项在宿主 UI 验证 |
| XML 支持 | 否 | — | 已拆到独立 XML Support 插件 |

## XML Support（0.1.0）

| 能力 | 清单声明 | 本机验证 | 说明 |
| --- | --- | --- | --- |
| XML/XSD/XSL/SVG 识别 | 是 | 是 | 本地骨架测试 |
| 语法诊断 | 是 | 是 | LemMinX stdio 握手 + 错误 XML 诊断通过 |
| XSD 校验 | 是 | 是 | LemMinX 加载真实 note.xsd 验证通过 |
| 元素/属性补全 | 是 | 是 | 在 `<` 处补全返回 XSD 里的 `from` 元素 |
| 格式化 | 是 | 是 | `documentFormattingProvider: true` |
| 悬停 / 文档符号 / 折叠 / 重命名 | 是 | 部分 | 能力声明为 true；UI 呈现未逐项点验 |
| definition / 文档链接 | 是 | 否 | `definitionProvider: true`，实际是文档链接（打开 schema），不是元素到 XSD 声明的跳转 |
| Java 工具发现 | 是 | 待真机 | 本机有 Java 11/17/25；宿主 Toolchains 解析与 LSP 启动待装后验证 |

## 明确不支持

- 断点调试（无 DAP 适配器）。
- XML 元素到 XSD 声明的 go-to-definition（LemMinX 不提供该粒度）。
- Node 插件的 ESLint / Prettier / Jest / Vitest，pnpm / yarn / bun 自动切换。
