import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "io.github.lithe-idea.node-support", "language-server");
const install = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: dir,
  stdio: "inherit",
});
if (install.status !== 0) process.exit(install.status ?? 1);
const entry = join(dir, "node_modules", "typescript-language-server", "lib", "cli.mjs");
if (!existsSync(entry)) throw new Error("typescript-language-server entry missing after install");
const pkg = JSON.parse(readFileSync(join(dir, "node_modules", "typescript-language-server", "package.json"), "utf8"));
const ts = JSON.parse(readFileSync(join(dir, "node_modules", "typescript", "package.json"), "utf8"));
writeFileSync(
  join(dir, "versions.json"),
  JSON.stringify(
    {
      builtWithNode: process.version,
      packages: {
        "typescript-language-server": pkg.version,
        typescript: ts.version,
      },
      entry: "node_modules/typescript-language-server/lib/cli.mjs",
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`bundled typescript-language-server ${pkg.version} with typescript ${ts.version}\n`);
