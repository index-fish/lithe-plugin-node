import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const entries = {
  "typescript-language-server": "typescript-language-server/lib/cli.mjs",
  typescript: "typescript/lib/typescript.js",
  "@xml-tools/language-server": "@xml-tools/language-server/lib/server.js",
};
for (const [name, relative] of Object.entries(entries)) {
  if (!existsSync(join(dir, "node_modules", relative))) {
    throw new Error(`${name} entry missing after install: ${relative}`);
  }
}

const licenses = [
  ["typescript", "typescript/LICENSE.txt"],
  ["typescript-language-server", "typescript-language-server/LICENSE"],
  ["@xml-tools/language-server", "@xml-tools/language-server/LICENSE"],
];
const licenseDir = join(dir, "licenses");
mkdirSync(licenseDir, { recursive: true });
for (const [name, relative] of licenses) {
  const source = join(dir, "node_modules", relative);
  if (!existsSync(source)) throw new Error(`${name} license missing after install: ${relative}`);
  copyFileSync(source, join(licenseDir, `${name.replace("@", "").replace("/", "-")}.LICENSE`));
}

const versionOf = (name) =>
  JSON.parse(readFileSync(join(dir, "node_modules", name, "package.json"), "utf8")).version;
const versions = {
  "typescript-language-server": versionOf("typescript-language-server"),
  typescript: versionOf("typescript"),
  "@xml-tools/language-server": versionOf("@xml-tools/language-server"),
};
writeFileSync(
  join(dir, "versions.json"),
  JSON.stringify(
    {
      builtWithNode: process.version,
      packages: versions,
      entries,
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(
  `bundled typescript-language-server ${versions["typescript-language-server"]}, ` +
    `typescript ${versions.typescript}, ` +
    `@xml-tools/language-server ${versions["@xml-tools/language-server"]}\n`,
);
