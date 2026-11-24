# 构建资源说明

仓库构建两个插件，各自打包语言服务依赖。

## Node.js Support 的语言服务

Node 插件打包两个 npm 包：

| 包 | 固定版本 | 用途 |
| --- | --- | --- |
| `typescript` | 5.9.3 | tsserver 本体 |
| `typescript-language-server` | 5.1.0 | LSP 前端，node >= 20 |

版本固定在 `io.github.lithe-idea.node-support/language-server/package.json`，`package-lock.json` 记录每个依赖的来源和 integrity 哈希。`scripts/build-language-server.mjs` 在构建机执行 `npm install --ignore-scripts`，把 `node_modules` 放进插件包，写出 `versions.json`，并把两个包的 LICENSE 复制到 `language-server/licenses/`。

## XML Support 的语言服务

XML 插件打包 Eclipse LemMinX 的 uber-jar：

| 资源 | 固定版本 | 用途 |
| --- | --- | --- |
| `org.eclipse.lemminx-uber.jar` | 0.31.2 | XML LSP，含 Xerces（XSD/DTD 校验、补全、格式化等），Java >= 11 |

jar 来自 Eclipse 官方仓库 `repo.eclipse.org`，`scripts/build-xml-server.mjs` 下载后校验 SHA-256（`f4fde164e785c635e5f...`），不一致直接失败。LemMinX 按 EPL-2.0 分发，`language-server/LICENSE` 记录许可证标识与来源。写出 `versions.json` 记录版本、摘要、下载地址与运行时要求。

XML 插件不打包 JRE。Java 由宿主 Toolchains 解析：先查工具链设置里的显式覆盖，再查 `JAVA_HOME`、macOS `/Library/Java/JavaVirtualMachines`、Linux `/usr/lib/jvm`，最后查 PATH 中的 `java`。清单里的工具 ID 是限定 ID `io.github.lithe-idea.xml-support:java`，不会与其他插件可能定义的短 ID `java` 冲突。

## 缓存与复用

构建使用 npm 自己的缓存（默认 `~/.npm`）。LemMinX jar 下载后缓存在插件的 `language-server/` 目录，摘要一致时不重复下载。`package-lock.json` 保证不同工作树解析到同一组 Node 依赖版本。

## 安装期约束

安装后的插件包只读，不执行 `npm install`，也不从网络下载语言服务。Node 插件要求用户机器有 Node >= 20；XML 插件要求 Java >= 11。缺运行时时声明式贡献失败并由宿主记录终态。

## 许可证

- Node 插件：`typescript`、`typescript-language-server` 按 Apache-2.0 分发，LICENSE 在 `language-server/licenses/`。
- XML 插件：LemMinX 按 EPL-2.0 分发，许可证标识在 `language-server/LICENSE`。
