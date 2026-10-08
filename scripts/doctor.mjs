/* global console, process, URL */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
let failures = 0;
function check(label, ok, remedy) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}${ok ? "" : ` — ${remedy}`}`);
  if (!ok) failures++;
}
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const pinned = readFileSync(resolve(root, ".nvmrc"), "utf8").trim().replace(/^v/, "");
const actual = process.versions.node.split(".").map(Number);
const minimum = pinned.split(".").map(Number);
const nodeOk = actual[0] === minimum[0] &&
  (actual[1] > minimum[1] || (actual[1] === minimum[1] && actual[2] >= minimum[2]));
check(`Node ${process.versions.node} (tested ${pinned})`, nodeOk, "Activate .nvmrc Node before npm ci");
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
check(`Package and lockfile version ${pkg.version}`, pkg.version === lock.version && pkg.version === lock.packages[""].version, "Update both with npm version --no-git-tag-version");
check("Dependencies installed", existsSync(resolve(root, "node_modules/.bin/vite")), "Run npm ci");
for (const path of ["wrangler.jsonc", "migrations/0005_community_profiles.sql", "AGENTS.md", "CLAUDE.md", "docs/handoff.md"])
  check(path, existsSync(resolve(root, path)), "Restore the missing checked-in file");
try {
  check("Claude shares repository skills", realpathSync(resolve(root, ".claude/skills")) === realpathSync(resolve(root, ".agents/skills")), "Restore .claude/skills symlink or load .agents/skills directly");
} catch {
  check("Claude shares repository skills", false, "Restore .claude/skills symlink or load .agents/skills directly");
}
try {
  const { chromium } = await import("@playwright/test");
  check("Playwright Chromium installed", existsSync(chromium.executablePath()), "Run npx playwright install chromium");
} catch {
  check("Playwright available", false, "Run npm ci then npx playwright install chromium");
}
console.log("Local database: run npm run setup before serving; no remote login or secret is needed.");
console.log("Ports: dev 3000, tests 3100, suggested preview 3200. Keep dev origin stable for saves.");
process.exitCode = failures ? 1 : 0;
