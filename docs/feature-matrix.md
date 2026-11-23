# 功能矩阵

最近验证：2026-11-23，本地骨架测试、XML LSP stdio 握手与官方 schema/规则复核。宿主端到端未执行。

| 能力 | macOS | Windows | Linux | 证据 / 说明 |
| --- | --- | --- | --- | --- |
| JS / TS 语法高亮 | 由宿主提供 | 由宿主提供 | 由宿主提供 | 宿主内置 `JavaScript*.tmLanguage.json` / `TypeScript*.tmLanguage.json`；非插件能力 |
| JS / TS 补全、跳转、诊断 | 未验证 | 未验证 | 未验证 | `languageServers[]` 声明 tsserver；需真实宿主安装后验证 |
| XML 文件识别与注释/括号配置 | 未验证 | 未验证 | 未验证 | `languages[id=xml]`，覆盖 `xml`/`xsd`/`xsl`/`xslt`/`svg` 与常见 XML 文件名 |
| XML 语法诊断 | 未验证 | 未验证 | 未验证 | `@xml-tools/language-server@1.1.2` 通过 Node runtime 启动，stdio 握手本地已验证；Lithe 桌面端呈现待真机确认 |
| XML XSD 补全 / 跳转 / 格式化 | 不支持 | 不支持 | 不支持 | 当前服务器只提供语法诊断；需换更强的 XML 服务 |
| Node 工具发现（PATH / nvm / fnm） | 未验证 | 未验证 | 未验证 | `toolDefinitions[node]` + `scripts/test.mjs` 只做静态检查 |
| npm script 模型解析 | 已验证 | 已验证 | 已验证 | `scripts/test.mjs` 在 fixture 上执行模型脚本，得到 2 个 target / 2 个 task |
| npm script 自动 Run 入口 | 未验证 | 未验证 | 未验证 | `buildSystems[0].run.fromTasks.templates = ["script"]` |
| npm install 任务 | 未验证 | 未验证 | 未验证 | 声明式任务；执行 npm 的真实行为未测 |
| Node 文件运行配置 | 未验证 | 未验证 | 未验证 | `runConfigurationTypes[node-file]` |
| npm 脚本运行配置 | 未验证 | 未验证 | 未验证 | `runConfigurationTypes[npm-script]` |
| 中英文文案 | 已验证 | 已验证 | 已验证 | `plugin-l10n.schema.json` 校验通过；宿主显示未验证 |
| 日志接线 | 未验证 | 未验证 | 未验证 | 无后端；声明式贡献由宿主观察，规格见 README |
| 断点调试 | 不支持 | 不支持 | 不支持 | Phase 3 |
| pnpm / yarn / bun 自动切换 | 不支持 | 不支持 | 不支持 | Phase 2 |
