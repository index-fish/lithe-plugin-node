import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Node plugin: inline scripts via placeholders.
const nodeDir = join(root, "io.github.lithe-idea.node-support");
const read = (name) => readFileSync(join(nodeDir, "scripts", name), "utf8").trim();
const replacements = {
  '"@@MODEL_JS@@"': JSON.stringify(read("model.js")),
  '"@@NPM_RUN_JS@@"': JSON.stringify(read("npm-run.js")),
  '"@@NPM_INSTALL_JS@@"': JSON.stringify(read("npm-install.js")),
};
let nodeText = readFileSync(join(nodeDir, "plugin.template.json"), "utf8");
for (const [key, value] of Object.entries(replacements)) {
  if (!nodeText.includes(key)) throw new Error(`missing placeholder ${key}`);
  nodeText = nodeText.replaceAll(key, value);
}
writeFileSync(join(nodeDir, "plugin.json"), nodeText);

// XML plugin: no inline scripts, template is the manifest.
const xmlDir = join(root, "io.github.lithe-idea.xml-support");
writeFileSync(
  join(xmlDir, "plugin.json"),
  readFileSync(join(xmlDir, "plugin.template.json"), "utf8"),
);

// SQL plugin: zero-dependency server, template is the manifest.
const sqlDir = join(root, "io.github.lithe-idea.sql-support");
writeFileSync(
  join(sqlDir, "plugin.json"),
  readFileSync(join(sqlDir, "plugin.template.json"), "utf8"),
);

process.stdout.write("rendered plugin.json for node, xml and sql plugins\n");
