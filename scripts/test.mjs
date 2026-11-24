import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDir = join(root, "io.github.lithe-idea.node-support");
const script = (name) => readFileSync(join(packageDir, "scripts", name), "utf8").trim();
const js = {
  model: script("model.js"),
  run: script("npm-run.js"),
  install: script("npm-install.js"),
};
let template = readFileSync(join(packageDir, "plugin.template.json"), "utf8");
template = template
  .replaceAll('"@@MODEL_JS@@"', JSON.stringify(js.model))
  .replaceAll('"@@NPM_RUN_JS@@"', JSON.stringify(js.run))
  .replaceAll('"@@NPM_INSTALL_JS@@"', JSON.stringify(js.install));
const generated = readFileSync(join(packageDir, "plugin.json"), "utf8");
if (generated !== template) throw new Error("plugin.json is stale; run scripts/render-manifest.mjs");
const manifest = JSON.parse(generated);
JSON.parse(readFileSync(join(packageDir, "l10n", "zh-Hans.json"), "utf8"));
const pinned = JSON.parse(readFileSync(join(packageDir, "language-server", "package.json"), "utf8"));
if (
  pinned.dependencies.typescript !== "5.9.3" ||
  pinned.dependencies["typescript-language-server"] !== "5.1.0" ||
  "@xml-tools/language-server" in pinned.dependencies
) {
  throw new Error("language server versions must stay pinned (XML server moved to its own plugin)");
}
for (const [name, code] of Object.entries(js)) {
  new Function(code);
}
const build = manifest.buildSystems[0];
if (build.model.arguments[1] !== js.model) throw new Error("model script is stale in plugin.json");
const strings = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
};
const hasCode = (entry, code) => strings(entry.arguments).includes(code);
if (!hasCode(build.tasks.find((task) => task.id === "install"), js.install)) {
  throw new Error("install script is stale in plugin.json");
}
if (!hasCode(build.tasks.find((task) => task.id === "script"), js.run)) {
  throw new Error("npm script template is stale in plugin.json");
}
// Core: a fromTasks run entry inherits the task's arguments and must not
// restate them (validation error: "Task run entries reuse the task's arguments.").
for (const run of build.run) {
  if (run.fromTasks && "arguments" in run) {
    throw new Error(`${run.id} fromTasks run must not declare arguments`);
  }
}
if (generated.includes("@@")) throw new Error("unreplaced placeholder in plugin.json");
for (const icon of ["node.svg", "node-dark.svg", "node-file.svg", "node-file-dark.svg", "node-script.svg", "node-script-dark.svg"]) {
  if (!existsSync(join(packageDir, "icons", icon))) throw new Error(`missing icon ${icon}`);
  // Lithe's icon renderer rejects <text>; a rejected plugin icon shows a wrong
  // placeholder. Icons must be pure path/shape geometry.
  if (/<text\b/i.test(readFileSync(join(packageDir, "icons", icon), "utf8"))) {
    throw new Error(`icon ${icon} contains an unsupported <text> element`);
  }
}
const result = spawnSync(process.execPath, ["-e", js.model], {
  cwd: join(root, "fixtures", "sample-app"),
  encoding: "utf8",
});
if (result.status !== 0) throw new Error(`model script failed: ${result.stderr}`);
const model = JSON.parse(result.stdout);
if (model.format !== "litheBuildModel" || model.version !== 0) throw new Error("bad model envelope");
if (model.targets.length !== 2 || model.tasks.length !== 2) throw new Error("fixture scripts not decoded");
if (!model.targets.every((target) => target.tags.includes("script"))) throw new Error("script tag missing");
if (!model.tasks.every((task) => task.template === "script")) throw new Error("script task template missing");
if (build.id !== "node" || !build.run?.[0]?.fromTasks?.templates?.includes("script")) {
  throw new Error("npm script run entry missing");
}
if (manifest.languageServers.length !== 2) {
  throw new Error("JavaScript and TypeScript servers are both required");
}
for (const server of manifest.languageServers) {
  if (server.launch.kind !== "runtime") throw new Error(`${server.languageID} must use a runtime launch`);
  if (server.launch.tool !== "node") throw new Error(`${server.languageID} must launch with node`);
  if (!manifest.requiresTools.includes(server.launch.tool)) {
    throw new Error(`${server.languageID} launch tool is not declared in requiresTools`);
  }
  if ("validationArguments" in server) {
    throw new Error(`${server.languageID} runtime launch must not carry validationArguments`);
  }
  if ("runtimeDependencies" in server) {
    throw new Error(`${server.languageID} must not repeat the launch runtime as a runtime dependency`);
  }
  // Pin the bundled TS 5.9.3. Without tsserver.path, typescript-language-server
  // prefers the workspace's TypeScript (e.g. an old 4.8.2), which indexes a
  // large project slowly and lets completion requests hit the host's 30s
  // timeout ("Late language-server response ignored").
  const tsPath = server.initializationOptions?.tsserver?.path;
  if (tsPath !== "${pluginDir}/language-server/node_modules/typescript/lib/tsserver.js") {
    throw new Error(`${server.languageID} must pin the bundled tsserver via initializationOptions.tsserver.path`);
  }
  // In projects whose files import unresolved bare modules (e.g. svr-api/*),
  // tsserver's global identifier completion scans every module export and hangs
  // indefinitely. Disabling module-export completions keeps identifier/keyword
  // completion fast (1805 items in ~50ms on a 223-file project).
  if (server.initializationOptions?.preferences?.includeCompletionsForModuleExports !== false) {
    throw new Error(`${server.languageID} must disable includeCompletionsForModuleExports to avoid completion hangs`);
  }
  // Belt and suspenders: also carry the preference in workspaceConfiguration,
  // so servers that re-read config via didChangeConfiguration keep it disabled.
  const wsPrefs = server.workspaceConfiguration?.[server.languageID]?.preferences;
  if (wsPrefs?.includeCompletionsForModuleExports !== false) {
    throw new Error(`${server.languageID} workspaceConfiguration.preferences must also disable includeCompletionsForModuleExports`);
  }
  if (!existsSync(join(packageDir, "language-server/node_modules/typescript/lib/tsserver.js"))) {
    throw new Error("bundled tsserver.js missing; run npm run build:ls");
  }
}
// XML lives in its own plugin now.
if (manifest.languages.some((language) => language.id === "xml")) {
  throw new Error("XML language must be removed from the Node plugin");
}
if (manifest.activationEvents.includes("onLanguage:xml")) {
  throw new Error("XML activation event must be removed from the Node plugin");
}
process.stdout.write("node plugin skeleton checks passed\n");
