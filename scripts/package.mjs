import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDir = join(root, "io.github.lithe-idea.node-support");
const manifest = JSON.parse(readFileSync(join(packageDir, "plugin.json"), "utf8"));
const stage = join(root, ".build", "package", manifest.id);
const dist = join(root, "dist");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(dist, { recursive: true });
for (const name of ["plugin.json", "l10n", "icons", "scripts", "language-server"]) {
  cpSync(join(packageDir, name), join(stage, name), { recursive: true });
}
const archive = join(dist, `${manifest.id}-${manifest.version}.zip`);
rmSync(archive, { force: true });
const zip = spawnSync("zip", ["-qr", archive, manifest.id], { cwd: resolve(stage, ".."), stdio: "inherit" });
if (zip.status !== 0) throw new Error("zip failed");
const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(`${archive}.sha256`, `${sha256}  ${archive.split("/").pop()}\n`);
if (!existsSync(join(stage, "language-server", "versions.json"))) {
  process.stdout.write("warning: language-server/versions.json missing; run scripts/build-language-server.mjs first\n");
}
process.stdout.write(`${archive}\n${sha256}\n`);
