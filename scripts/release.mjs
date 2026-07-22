/**
 * Release script — bumps the version in all manifest files, commits, tags and
 * pushes. Pushing a `vX.Y.Z` tag normally triggers .github/workflows/release.yml,
 * which builds the desktop installers and publishes a GitHub Release.
 *
 * Usage:
 *   npm run release -- patch            → 0.1.0 → 0.1.1
 *   npm run release -- minor            → 0.1.0 → 0.2.0
 *   npm run release -- major            → 0.1.0 → 1.0.0
 *   npm run release -- 1.2.3            → explicit version
 *   npm run release -- patch --dry-run  → preview only, no git ops
 *   npm run release -- patch --local    → bump + commit + tag, and still pushes
 *                                          both to the remote, but the commit
 *                                          message carries "[skip ci]" so GitHub
 *                                          Actions does NOT run for this push.
 *                                          Normal `npm run release` (no --local)
 *                                          keeps triggering CI as always.
 *   npm run release -- patch --local --build
 *                                        → also runs `tauri build` right here,
 *                                          producing the same installer(s) CI
 *                                          would build for this OS (dmg on
 *                                          macOS, msi/nsis on Windows) under
 *                                          src-tauri/target/release/bundle/
 *
 * Before touching any file, it checks that src/data/changelog.ts already has
 * an entry for the version being released (v: "X.Y.Z") — the bilingual "what's
 * new" wall shown in Tu espacio › Novedades. Add that entry first; pass
 * --no-changelog-check only for a release that has no user-facing changes.
 *
 * Files updated:
 *   package.json                 "version"
 *   src-tauri/tauri.conf.json    "version"
 *   src-tauri/Cargo.toml         version = "..."
 *   src-tauri/Cargo.lock         resynced via cargo update -p macup
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CRATE = "macup";

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  const result = execSync(cmd, { cwd: ROOT, stdio: "pipe", ...opts });
  return result ? result.toString().trim() : "";
}

function bump(current, type) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Cannot parse current version: ${current}`);
  }
  switch (type) {
    case "major":
      return `${parts[0] + 1}.0.0`;
    case "minor":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      if (!/^\d+\.\d+\.\d+$/.test(type)) {
        throw new Error(
          `Invalid version or bump type: "${type}". Use patch | minor | major | x.y.z`,
        );
      }
      return type;
  }
}

function confirm(question) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

// ── file updaters ─────────────────────────────────────────────────────────────

function updatePackageJson(next) {
  const path = resolve(ROOT, "package.json");
  const obj = JSON.parse(readFileSync(path, "utf8"));
  const prev = obj.version;
  obj.version = next;
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
  return prev;
}

function updateTauriConf(next) {
  const path = resolve(ROOT, "src-tauri/tauri.conf.json");
  const obj = JSON.parse(readFileSync(path, "utf8"));
  obj.version = next;
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function updateCargoToml(next) {
  const path = resolve(ROOT, "src-tauri/Cargo.toml");
  let content = readFileSync(path, "utf8");
  // Replace the first `version = "x.y.z"` line (in [package]).
  content = content.replace(/^(version\s*=\s*)"[^"]*"/m, `$1"${next}"`);
  writeFileSync(path, content);
}

function syncCargoLock() {
  // Cargo.lock pins our own crate to its previous version; running cargo update
  // against the bumped Cargo.toml rewrites that pin so the lockfile lands in the
  // same release commit instead of as a stray change later.
  run(`cargo update -p ${CRATE} --manifest-path src-tauri/Cargo.toml`, {
    stdio: "inherit",
  });
}

function hasChangelogEntry(version) {
  // El muro de "Novedades" (src/data/changelog.ts) es bilingüe y vive aparte
  // del diccionario genérico de traducciones; comprobamos aquí que no se
  // publique una versión sin su entrada correspondiente.
  const content = readFileSync(resolve(ROOT, "src/data/changelog.ts"), "utf8");
  return content.includes(`v: "${version}"`);
}

function platformBundles() {
  // Mirrors the per-OS `bundles` in .github/workflows/release.yml's matrix.
  switch (process.platform) {
    case "darwin":
      return "dmg";
    case "win32":
      return "msi,nsis";
    default:
      return "deb,rpm,appimage";
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const FLAGS = ["--dry-run", "--local", "--build", "--no-changelog-check"];
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const local = args.includes("--local");
const build = args.includes("--build");
const skipChangelogCheck = args.includes("--no-changelog-check");
const bumpArg = args.find((a) => !FLAGS.includes(a));

if (!bumpArg) {
  console.error(
    "Usage: npm run release -- <patch|minor|major|x.y.z> [--dry-run] [--local] [--build]",
  );
  process.exit(1);
}

const currentVersion = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf8"),
).version;

const nextVersion = bump(currentVersion, bumpArg);
const tag = `v${nextVersion}`;
const changelogOk = hasChangelogEntry(nextVersion);

if (!changelogOk && !skipChangelogCheck) {
  console.error(
    `\n  No changelog entry for ${nextVersion} in src/data/changelog.ts.\n` +
      `  Add a bilingual entry (v, date, title, body[, more]) for this release\n` +
      `  before running this script, or pass --no-changelog-check to skip on purpose.\n`,
  );
  process.exit(1);
}

console.log(`\n  Current   : ${currentVersion}`);
console.log(`  Next      : ${nextVersion}`);
console.log(`  Tag       : ${tag}`);
console.log(
  `  Changelog : ${changelogOk ? "entry found" : "MISSING (skipped by flag)"}`,
);
if (local) {
  console.log(
    "  Mode      : local (pushes commit + tag with [skip ci] — GitHub Actions will NOT run)",
  );
}
if (build) {
  console.log(
    `  Build     : yes, locally after tagging (--bundles ${platformBundles()})`,
  );
}
if (dryRun) {
  console.log("\n  [dry-run] No changes written.\n");
  process.exit(0);
}

const answer = await confirm(`\n  Continue? [y/N] `);
if (answer !== "y" && answer !== "yes") {
  console.log("  Aborted.\n");
  process.exit(0);
}

try {
  const status = run("git status --porcelain");
  if (status) {
    console.warn(
      "\n  Warning: working tree has uncommitted changes. They will be included in the release commit.",
    );
  }
} catch {
  // git not available or not a repo — continue anyway
}

updatePackageJson(nextVersion);
updateTauriConf(nextVersion);
updateCargoToml(nextVersion);
syncCargoLock();
console.log(
  `\n  Updated package.json, tauri.conf.json, Cargo.toml, Cargo.lock → ${nextVersion}`,
);

try {
  const commitMessage = `chore: release ${tag}${local ? " [skip ci]" : ""}`;
  run("git add -A", { stdio: "inherit" });
  run(`git commit -m "${commitMessage}"`, { stdio: "inherit" });
  run(`git tag ${tag}`, { stdio: "inherit" });
  console.log(`\n  Pushing commit and tag ${tag}…`);
  run("git push", { stdio: "inherit" });
  run(`git push origin ${tag}`, { stdio: "inherit" });
  if (local) {
    console.log(
      `\n  Done! Pushed commit + tag ${tag} — the commit carries [skip ci], so GitHub Actions will NOT run.\n`,
    );
  } else {
    console.log(`\n  Done! GitHub Actions will build and publish the release.\n`);
  }
} catch (err) {
  console.error("\n  Git operation failed:", err.message);
  console.error(
    "  Version files were updated locally. Commit and push manually.\n",
  );
  process.exit(1);
}

if (build) {
  const bundles = platformBundles();
  console.log(
    `\n  Building installer(s) locally (same as CI would, for ${process.platform}: --bundles ${bundles})…\n`,
  );
  try {
    run(`npx tauri build --bundles ${bundles}`, { stdio: "inherit" });
    console.log(
      `\n  Build complete → src-tauri/target/release/bundle/\n`,
    );
  } catch (err) {
    console.error("\n  Build failed:", err.message);
    console.error(
      "  Version was bumped and tagged already; fix the build and run `npx tauri build` manually.\n",
    );
    process.exit(1);
  }
}
