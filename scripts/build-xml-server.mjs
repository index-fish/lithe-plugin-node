import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "io.github.lithe-idea.xml-support", "language-server");
mkdirSync(dir, { recursive: true });

const VERSION = "0.31.2";
const URL =
  `https://repo.eclipse.org/content/repositories/lemminx-releases/org/eclipse/lemminx/` +
  `org.eclipse.lemminx/${VERSION}/org.eclipse.lemminx-${VERSION}-uber.jar`;
const SHA256 = "f4fde164e785c635e5f86361dbf4b993bfe2c5f83fdb52891d058b7dfc9bcfc8";
const jar = join(dir, `org.eclipse.lemminx-${VERSION}-uber.jar`);

if (!existsSync(jar)) {
  const dl = spawnSync("curl", ["-sSL", "--fail", "--retry", "3", "--connect-timeout", "30", "-o", jar, URL], {
    stdio: "inherit",
  });
  if (dl.status !== 0) throw new Error(`failed to download LemMinX ${VERSION}`);
}
const actual = createHash("sha256").update(readFileSync(jar)).digest("hex");
if (actual !== SHA256) {
  throw new Error(`LemMinX jar sha256 mismatch: expected ${SHA256}, got ${actual}`);
}

// LemMinX is EPL-2.0. Record the license identifier and upstream notice in the package.
const licenseSrc = join(dir, "LICENSE");
if (!existsSync(licenseSrc)) {
  writeFileSync(
    licenseSrc,
    "Eclipse Public License - v 2.0 (EPL-2.0)\n" +
      "LemMinX (org.eclipse.lemminx) is licensed under EPL-2.0.\n" +
      "Full text: https://www.eclipse.org/legal/epl-2.0/\n" +
      "Source: https://github.com/eclipse/lemminx\n",
  );
}

writeFileSync(
  join(dir, "versions.json"),
  JSON.stringify(
    {
      lemminx: VERSION,
      jar: `org.eclipse.lemminx-${VERSION}-uber.jar`,
      sha256: SHA256,
      url: URL,
      license: "EPL-2.0",
      runtime: "Java 11+ (resolved via Toolchains)",
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`bundled LemMinX ${VERSION} (sha256 ${actual.slice(0, 12)}...)\n`);
