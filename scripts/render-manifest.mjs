import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "io.github.lithe-idea.node-support");
const read = (name) => readFileSync(join(dir, "scripts", name), "utf8").trim();
const replacements = {
  '"@@MODEL_JS@@"': JSON.stringify(read("model.js")),
  '"@@NPM_RUN_JS@@"': JSON.stringify(read("npm-run.js")),
  '"@@NPM_INSTALL_JS@@"': JSON.stringify(read("npm-install.js")),
};
let text = readFileSync(join(dir, "plugin.template.json"), "utf8");
for (const [key, value] of Object.entries(replacements)) {
  if (!text.includes(key)) throw new Error(`missing placeholder ${key}`);
  text = text.replaceAll(key, value);
}
writeFileSync(join(dir, "plugin.json"), text);
process.stdout.write("rendered plugin.json\n");
