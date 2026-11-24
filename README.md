# Lithe 插件：Node.js Support + XML Support

这个仓库提供两个独立的声明式 Lithe 插件，共用一套构建与发布流程：

| 插件 ID | 作用 | 运行时依赖 |
| --- | --- | --- |
| `io.github.lithe-idea.node-support` | JavaScript / TypeScript 语言服务 + npm scripts 构建/运行入口 | Node.js >= 20 |
| `io.github.lithe-idea.xml-support` | XML / XSD / XSL / SVG 的完整语言服务（LemMinX） | Java >= 11 |

插件不修改 Lithe 宿主或 Rust Core。两个插件各自独立版本、独立 Release、独立安装。

## Node.js Support

当前版本：`0.1.7`。

- 语言：`js`、`jsx`、`mjs`、`cjs`、`ts`、`tsx`、`mts`、`cts`。语法高亮用宿主内置 TextMate grammar，插件只补语义。
- 语言服务：Node runtime 启动包内 `typescript-language-server`（JavaScript、TypeScript 各一个会话）。
- 工具链：声明 `node` tool definition，支持 PATH、nvm、fnm；可用设置显式指定 node 可执行文件。
- 构建与运行：扫描 `package.json` 的 `scripts` 生成 npm script 任务和自动 Run 入口；另有“Node 文件”“npm 脚本”两种手动运行配置。
- 设置：Node 可执行文件、tsserver 内存上限、import 路径样式、package.json 自动导入、参数名与变量类型提示。
- XML 支持已拆到独立的 XML Support 插件，本插件不再包含 XML。

前置条件：Node.js >= 20、`npm` 在 PATH 中。tsserver 会加载工作区配置，清单声明了 `executesProjectCode: true`，首次打开工作区需信任。

## XML Support（LemMinX）

当前版本：`0.1.0`。

- 语言：`xml`、`xsd`、`xsl`、`xslt`、`svg`，以及 `pom.xml` / `web.xml` / `persistence.xml` / `applicationContext.xml`。
- 语言服务：Eclipse LemMinX `0.31.2`（EPL-2.0），提供语法与 XSD/DTD 校验、元素/属性补全、格式化、悬停、文档大纲、折叠、重命名、文档链接。
- 跳转说明：LemMinX 的 `definitionProvider` 为文档链接级别（例如点击 `xsi:schemaLocation` 打开 XSD），不是元素名到 XSD 声明的 go-to-definition。
- 工具链：声明限定 ID `io.github.lithe-idea.xml-support:java` 的 JDK 定义，Lithe Toolchains 自动发现本机 Java（`JAVA_HOME`、常见安装目录、PATH）；也可在工具链设置里显式指定。
- 不执行工作区代码：XSD/DTD 只作为数据读取，清单不声明 `executesProjectCode`。
- 设置：JVM 堆内存上限。

前置条件：本机 Java >= 11（LemMinX 0.31.2 的编译目标）。JDK/JRE 均可，不需要 Maven。

## 安装

推荐从第三方插件源安装：

1. Lithe：设置 → 插件 → 插件市场 → 打开“插件仓库”对话框。
2. 粘贴 `https://github.com/index-fish/lithe-plugin-node`，点“添加”。仓库根目录的 `lithe-plugin-index.json` 是插件源索引，里面有两个插件条目。
3. 在插件市场选择该来源，按需安装 Node.js Support 和/或 XML Support。

也可从磁盘安装 `dist/` 里的 ZIP（设置 → 插件 → 从磁盘安装）。

## 构建

```bash
npm run render     # 从 template + scripts 生成两个 plugin.json
npm run build:ls   # 构建期安装 TS 语言服务、下载并校验 LemMinX jar
npm run test       # 两个插件的骨架检查 + Node fixture 模型测试
npm run package    # 产出 dist/<plugin-id>-<version>.zip 和 sha256
```

语言服务依赖固定版本：Node 插件锁定 `typescript@5.9.3` + `typescript-language-server@5.1.0`；XML 插件锁定 `org.eclipse.lemminx@0.31.2`，构建期校验 SHA-256。安装后的插件包不再下载任何东西。详见 `docs/build-resources.md`。

## 发布

用带插件前缀的 tag 触发，tag 里的版本必须与对应插件的 `plugin.json` 一致：

```bash
git tag node-v0.1.10 && git push origin node-v0.1.10  # 只发 Node 插件
git tag xml-v0.1.0  && git push origin xml-v0.1.0    # 只发 XML 插件
```

`.github/workflows/release.yml` 校验 tag 与版本一致，构建、测试、打包后创建对应 Release 并上传 ZIP 与 sha256。索引 `lithe-plugin-index.json` 在发布后手工更新到新的版本与 GitHub 权威 SHA-256。

## 日志接线

插件没有后端进程，所有贡献都是声明式的。语言服务由 Core 记录 `languageServer/start` 的终态；构建模型、任务和 Run 入口各记录进程终态；静态内容记录安装/校验/激活/加载失败。安装失败的确切错误在宿主日志 `~/Library/Logs/Lithe Desktop/sessions/<session>/app.log` 的 `event=app.notification.operation_failed` 行。

## 已知边界

- XML 的跳转是文档链接级别，不是元素到 XSD 声明的 go-to-definition。
- 没有断点调试（未接 DAP）。
- Node 插件没有 ESLint / Prettier / Jest / Vitest 集成，也没有 pnpm / yarn / bun 自动切换。
- 两个语言 ID 会各启动一个 tsserver 会话。
- 为避免补全卡死，`includeCompletionsForModuleExports` 设为 `false`（在 `initializationOptions.preferences` 和 `workspaceConfiguration.<lang>.preferences` 两处都带上）：在含大量未解析裸模块 import（如 `svr-api/*`）的项目里，tsserver 收集模块导出符号会让标识符补全永久挂起。关闭后，标识符与关键字补全正常，但 `import` 语句里的模块导出补全需手动触发或依赖路径补全。
- Lithe 的补全弹窗原样显示 LSP 返回的列表，不做前缀过滤；tsserver 对 invoked 补全返回全集并期望客户端收窄。Node 插件因此通过 `language-server/proxy.mjs` 在 stdio 层拦截补全响应：按当前标识符过滤+排序候选项，并为不带 `textEdit` 的项补上替换范围（否则输入 `cons` 选 `const` 会变成 `consconst`）。代理只改补全响应，其余 LSP 消息原样透传。
- Windows、Linux 的宿主机端到端行为尚未验证。
