import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDir = join(root, "io.github.lithe-idea.xml-support");
const template = readFileSync(join(packageDir, "plugin.template.json"), "utf8");
const generated = readFileSync(join(packageDir, "plugin.json"), "utf8");
if (generated !== template) throw new Error("xml plugin.json is stale; run scripts/render-manifest.mjs");
const manifest = JSON.parse(generated);
JSON.parse(readFileSync(join(packageDir, "l10n", "zh-Hans.json"), "utf8"));

if (manifest.id !== "io.github.lithe-idea.xml-support") throw new Error("unexpected XML plugin id");
if (manifest.version !== "0.1.0") throw new Error("unexpected XML plugin version");
if (generated.includes("@@")) throw new Error("unreplaced placeholder in XML plugin.json");

// No project code execution: XSD/DTD are read as data, never executed.
if (manifest.requires.languageServers !== 0) {
  throw new Error("XML server does not execute project code; languageServers should stay 0");
}
const servers = manifest.languageServers;
if (servers.length !== 1 || servers[0].languageID !== "xml") {
  throw new Error("exactly one XML language server is required");
}
const server = servers[0];
if (server.launch.kind !== "runtime") throw new Error("XML server must use a runtime launch");
if (server.launch.tool !== "io.github.lithe-idea.xml-support:java") {
  throw new Error("XML server must launch with the qualified java tool id");
}
if (server.launch.minimumVersion !== "11") throw new Error("LemMinX requires Java 11+");
if (server.launch.entry !== "language-server/org.eclipse.lemminx-0.31.2-uber.jar") {
  throw new Error("LemMinX entry is stale");
}
if (server.arguments?.[0] !== "--stdio") throw new Error("XML server must use stdio");
if ("executesProjectCode" in server) {
  throw new Error("XML server must not declare executesProjectCode (defaults to false)");
}
if ("validationArguments" in server) {
  throw new Error("XML runtime launch must not carry validationArguments");
}
if ("runtimeDependencies" in server) {
  throw new Error("XML server must not repeat the launch runtime as a runtime dependency");
}
if (!manifest.requiresTools.includes(server.launch.tool)) {
  throw new Error("XML launch tool is not declared in requiresTools");
}

// Tool definition: qualified id, -jar launch, version probe.
const tools = manifest.toolDefinitions.filter((t) => t.id === "io.github.lithe-idea.xml-support:java");
if (tools.length !== 1) throw new Error("qualified java tool definition missing");
const tool = tools[0];
if (!tool.launch.includes("-jar") || !tool.launch.includes("${entry}")) {
  throw new Error("java tool launch must expand -jar ${entry}");
}
if (tool.version?.arguments?.[0] !== "-version") throw new Error("java version probe missing");
if (!manifest.languages.some((l) => l.id === "xml")) throw new Error("XML language declaration missing");
if (!manifest.activationEvents.includes("onLanguage:xml")) throw new Error("XML activation event missing");
if ("buildSystems" in manifest) throw new Error("XML plugin must not declare build systems");
for (const icon of ["xml.svg", "xml-dark.svg"]) {
  if (!existsSync(join(packageDir, "icons", icon))) throw new Error(`missing icon ${icon}`);
}
if (!existsSync(join(packageDir, "language-server", "org.eclipse.lemminx-0.31.2-uber.jar"))) {
  throw new Error("LemMinX jar missing; run scripts/build-xml-server.mjs");
}
process.stdout.write("xml plugin skeleton checks passed\n");
