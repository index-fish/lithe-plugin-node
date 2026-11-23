# 构建资源说明

## 语言服务包

插件不携带自写语言服务器，只打包三个 npm 包：

| 包 | 固定版本 | 用途 |
| --- | --- | --- |
| `typescript` | 5.9.3 | tsserver 本体 |
| `typescript-language-server` | 5.1.0 | LSP 前端，node >= 20 |
| `@xml-tools/language-server` | 1.1.2 | XML 语法诊断，node 运行，不需要 JDK |

版本固定在 `io.github.lithe-idea.node-support/language-server/package.json`，`package-lock.json` 记录每个依赖的来源和 integrity 哈希。`scripts/build-language-server.mjs` 在构建机执行 `npm install --ignore-scripts`，把 `node_modules` 放进插件包，写出 `versions.json` 记录构建时的 Node 版本和实际解析到的包版本，并把三个包的 LICENSE 复制到 `language-server/licenses/`。

## 缓存与复用

构建使用 npm 自己的缓存（默认 `~/.npm`）。多个工作树可以复用该缓存；`package-lock.json` 保证不同工作树解析到同一组版本。构建脚本不使用项目目录作为运行时下载源。

## 安装期约束

安装后的插件包只读，不执行 `npm install`，也不从网络下载。若用户机器上没有 Node 或 npm，声明式贡献会失败并由宿主记录终态。Phase 2 若加入 `commandInstallers`，每个安装目标、命令、网络和目录都必须在安装审查中显示并由用户确认。

## 许可证

`typescript`、`typescript-language-server` 与 `@xml-tools/language-server` 均按各自包内许可证分发（Apache-2.0）。构建脚本会把 LICENSE 复制到插件包的 `language-server/licenses/`，随 ZIP 一起发布。
