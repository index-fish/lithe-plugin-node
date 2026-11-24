import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirs = [
  join(root, "io.github.lithe-idea.node-support"),
  join(root, "io.github.lithe-idea.xml-support"),
  join(root, "io.github.lithe-idea.sql-support"),
];
const stageRoot = join(root, ".build", "package");
const dist = join(root, "dist");
rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stageRoot, { recursive: true });
mkdirSync(dist, { recursive: true });

for (const packageDir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(packageDir, "plugin.json"), "utf8"));
  const stage = join(stageRoot, manifest.id);
  mkdirSync(stage, { recursive: true });
  for (const name of ["plugin.json", "l10n", "icons", "scripts", "language-server"]) {
    const source = join(packageDir, name);
    if (existsSync(source)) cpSync(source, join(stage, name), { recursive: true });
  }
  const archive = join(dist, `${manifest.id}-${manifest.version}.zip`);
  rmSync(archive, { force: true });
  const zip = spawnSync("zip", ["-qr", archive, manifest.id], { cwd: resolve(stageRoot), stdio: "inherit" });
  if (zip.status !== 0) throw new Error("zip failed");
  const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(`${archive}.sha256`, `${sha256}  ${archive.split("/").pop()}\n`);
  process.stdout.write(`${archive}\n${sha256}\n`);
}
