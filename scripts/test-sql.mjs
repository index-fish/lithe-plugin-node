import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompletions, diagnoseSql, formatSql, hoverAt } from "../io.github.lithe-idea.sql-support/language-server/sql-analysis.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "io.github.lithe-idea.sql-support");
const template = readFileSync(join(dir, "plugin.template.json"), "utf8");
const generated = readFileSync(join(dir, "plugin.json"), "utf8");
if (generated !== template) throw new Error("sql plugin.json is stale; run scripts/render-manifest.mjs");
const manifest = JSON.parse(generated);
JSON.parse(readFileSync(join(dir, "l10n", "zh-Hans.json"), "utf8"));

if (manifest.id !== "io.github.lithe-idea.sql-support") throw new Error("unexpected SQL plugin id");
if (manifest.version !== "0.1.0") throw new Error("unexpected SQL plugin version");
if (generated.includes("@@")) throw new Error("unreplaced placeholder in SQL plugin.json");
if (!manifest.languages.some((l) => l.id === "sql")) throw new Error("SQL language declaration missing");
if (!manifest.activationEvents.includes("onLanguage:sql")) throw new Error("SQL activation event missing");

const servers = manifest.languageServers;
if (servers.length !== 1 || servers[0].languageID !== "sql") throw new Error("exactly one SQL language server required");
const server = servers[0];
if (server.launch.kind !== "runtime" || server.launch.tool !== "io.github.lithe-idea.sql-support:node") {
  throw new Error("SQL server must use the qualified node tool");
}
if (server.launch.entry !== "language-server/server.mjs") throw new Error("SQL server entry is stale");
if ("validationArguments" in server || "runtimeDependencies" in server || "executesProjectCode" in server) {
  throw new Error("SQL server must not carry runtime validation/dependency overrides");
}
if (!manifest.requiresTools.includes(server.launch.tool)) throw new Error("SQL launch tool not declared in requiresTools");
const tools = manifest.toolDefinitions.filter((t) => t.id === server.launch.tool);
if (tools.length !== 1) throw new Error("qualified node tool definition missing");
for (const icon of ["sql.svg", "sql-dark.svg"]) {
  if (!existsSync(join(dir, "icons", icon))) throw new Error(`missing icon ${icon}`);
}
if (!existsSync(join(dir, "language-server", "server.mjs"))) throw new Error("SQL server entry missing");

// Completion: prefix filtering + replacement range (Lithe host does neither).
const text = "SELECT id, name FROM users WHERE na";
const items = buildCompletions(text, 0, text.length);
if (!items.length) throw new Error("no completions for document prefix");
if (items[0].label.toUpperCase() !== "NAME") {
  throw new Error("document column should rank first: " + items.slice(0, 5).map((i) => i.label).join(","));
}
for (const item of items) {
  if (!item.textEdit?.range) throw new Error("completion item missing textEdit: " + item.label);
  if (item.textEdit.range.start.character !== text.length - 2 || item.textEdit.range.end.character !== text.length) {
    throw new Error("completion replacement range does not cover the typed prefix: " + item.label);
  }
}
if (buildCompletions("SEL", 0, 3)[0]?.label !== "SELECT") throw new Error("keyword completion failed");
if (buildCompletions("SELECT cou", 0, 10)[0]?.label !== "COUNT") throw new Error("function completion failed");

// Diagnostics: conservative, no false positives on a valid statement.
if (diagnoseSql("SELECT 1;").length !== 0) throw new Error("false positive on valid SQL");
if (!diagnoseSql("SELECT (1;").some((d) => /Unclosed parenthesis/.test(d.message))) throw new Error("unclosed parenthesis not reported");
if (!diagnoseSql("SELECT 'abc").some((d) => /Unterminated string/.test(d.message))) throw new Error("unterminated string not reported");
if (!diagnoseSql("SELECT 1)").some((d) => /Unmatched closing/.test(d.message))) throw new Error("unmatched parenthesis not reported");

// Formatting and hover.
const formatted = formatSql("select id,name from users where id=1;");
if (!formatted.includes("SELECT") || !formatted.includes("\nFROM") || !formatted.includes("\nWHERE")) {
  throw new Error("formatting failed: " + JSON.stringify(formatted));
}
if (!hoverAt("SELECT 1", 0, 2)) throw new Error("keyword hover missing");

process.stdout.write("sql plugin skeleton and behavior checks passed\n");
