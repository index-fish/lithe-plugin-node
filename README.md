# Node.js Support (Preview) for Lithe

一个声明式 Lithe 插件：给 JavaScript / TypeScript 接上 `typescript-language-server`，给 XML 接上 `@xml-tools/language-server`，并把 `package.json` 里的 scripts 暴露成构建任务和 Run 入口。插件不修改 Lithe 宿主或 Rust Core。

当前版本：`0.1.4`。已修复宿主安装校验（`requires.languageServers: 1`）；LSP 启动与运行入口仍待更多真机验证。

## 能力

- 语言：`js`、`jsx`、`mjs`、`cjs`、`ts`、`tsx`、`mts`、`cts`，以及 `xml`、`xsd`、`xsl`、`xslt`、`svg` 和常见的 `pom.xml` / `web.xml` / `persistence.xml`。语法高亮继续用宿主内置的 TextMate grammar，插件只补语义。
- 语言服务：Node runtime 启动包内的 `typescript-language-server`（JavaScript、TypeScript）和 `@xml-tools/language-server`（XML）。XML 服务只做语法诊断，不执行工作区代码。
- 工具链：声明 `node` tool definition，支持 PATH、nvm、fnm 等常见位置；可用设置显式指定 node 可执行文件。XML 服务复用同一个 Node 运行时，不需要 JDK。
- 构建与运行：扫描 `package.json` 的 `scripts`，生成 npm script 任务和自动 Run 入口；另提供“Node 文件”和“npm 脚本”两种手动运行配置。
- 设置：Node 可执行文件、tsserver 内存上限、import 路径样式、package.json 自动导入、参数名与变量类型提示。
- 翻译：清单文案中英文；英文在 `plugin.json`，中文在 `l10n/zh-Hans.json`。

## 前置条件

- Node.js >= 20（插件构建时打包的 `typescript-language-server@5.1.0` 要求）。
- `npm` 在 `PATH` 中。运行 npm script 时由插件脚本调用本机 npm；Phase 1 不做 pnpm / yarn / bun 自动切换。
- 打开工作区时需要信任：tsserver 会加载工作区配置和插件，清单里声明了 `executesProjectCode: true`。

## 构建

```bash
node scripts/render-manifest.mjs     # 从 template + scripts 生成 plugin.json
node scripts/test.mjs                # 骨架检查与 fixture 模型测试
node scripts/build-language-server.mjs  # 构建期安装并锁定语言服务依赖
node scripts/package.mjs             # 产出 dist/<plugin-id>-<version>.zip 和 sha256
```

`build-language-server.mjs` 会在构建时执行 `npm install`，锁定版本写在 `io.github.lithe-idea.node-support/language-server/package.json` 和 `package-lock.json`。安装后的插件包不再下载任何东西。详见 `docs/build-resources.md`。

## 发布

推一个与插件版本一致的 tag 即可自动构建并发布，不需要额外 secret：

```bash
git tag v0.1.4
git push origin v0.1.4
```

`.github/workflows/release.yml` 会在 tag 推送时校验 tag 与 `plugin.json` 版本一致，依次跑骨架测试、构建期安装语言服务依赖、打包 ZIP，然后用仓库自带的 `GITHUB_TOKEN` 创建 Release 并上传 ZIP 与 sha256。已存在的 Release 会覆盖同名附件。手动触发（workflow_dispatch）只跑构建检查，不发布。

## 安装试用

从磁盘安装生成的 ZIP（Lithe：设置 → 插件 → 从磁盘安装）。安装审查应只显示 `node` 运行时、tsserver 包内入口和构建/运行命令。打开一个含 `package.json` 的工程后：

1. Build 窗口应出现 `npm scripts` 工具窗口，列出脚本任务。
2. Run 下拉应自动列出每个 npm script。
3. 打开 `.ts` / `.js` 文件应启动语言服务，补全、跳转和诊断可用。
4. 打开 `.xml` / `.xsd` / `.svg` 文件应启动 XML 语法诊断；Lithe 桌面端目前已接线的 LSP 呈现主要是诊断。

## 日志接线

插件没有后端进程，所有贡献都是声明式的：

| 来源 | 宿主记录 |
| --- | --- |
| `languageServers[]`（javascript / typescript） | `languageServer/start` 的开始和终态；程序缺失、启动失败、握手失败、超时、提前退出由 Core 定级 |
| `buildSystems[].model` 命令 | 构建模型尝试的终态；脚本退出非 0 即失败 |
| 任务和 Run 入口 | 构建/运行进程尝试的终态 |
| 语法、设置、翻译等静态内容 | 安装、校验、激活和加载失败 |

插件不自建日志文件，不向 stderr 写自由文本日志。失败必须让声明的程序以非 0 退出。

## 已知边界

- XML 目前只有语法诊断，没有 XSD 补全、跳转、格式化；如需完整 XML 语义，后续可换 LemMinX + Java 运行时或更强的 Node XML 服务。
- 没有断点调试。后续可加 `vscode-js-debug` DAP 适配器。
- 没有 ESLint / Prettier / Jest / Vitest 集成。
- 两个语言 ID 会各启动一个 tsserver 会话；后续可评估是否能共享。
- npm script 的自动运行入口依赖 package.json 脚本；未安装 npm 时运行会失败，Phase 2 可加 command installer。
- Windows、Linux 的宿主机端到端行为尚未验证。
