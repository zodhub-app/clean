#!/usr/bin/env -S npx tsx
/**
 * setup-agent-skills.ts
 * -----------------------------------------------------------------------------
 * Portable, TELEMETRY-FREE installer for Agent Skills + MCP servers.
 *
 * Copies a curated set of Agent Skills into `<dest>/.claude/skills/` and merges
 * a set of MCP servers into `<dest>/.mcp.json`. Pure `git` + `fs` — it NEVER
 * calls the `npx skills` CLI (which phones home to add-skill.vercel.sh with the
 * names of the skills you install and your search queries).
 *
 * Designed to be copied into any project (Tauri, Next.js, plain Node, …) and run
 * from its root:
 *
 *   npx tsx setup-agent-skills.ts                 # install all portable skills + MCPs
 *   npx tsx setup-agent-skills.ts --only frontend-design,webapp-testing
 *   npx tsx setup-agent-skills.ts --no-mcp        # skills only
 *   npx tsx setup-agent-skills.ts --mcp-only      # MCP merge only
 *   npx tsx setup-agent-skills.ts --dest ../other-project
 *   npx tsx setup-agent-skills.ts --list          # print the catalog and exit
 *   npx tsx setup-agent-skills.ts --dry-run       # show what would happen
 *
 * Requirements: git >= 2.27 (sparse-checkout cone mode) and Node >= 18 (for tsx).
 * No npm dependencies — only Node built-ins, so it runs anywhere `tsx` runs.
 * -----------------------------------------------------------------------------
 */

import { execFileSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Catalog — edit this block per project. Only PORTABLE skills are listed here
// (frontend + method). Repo-specific skills are intentionally excluded.
// ─────────────────────────────────────────────────────────────────────────────

type Transform = (skillDir: string, ctx: InstallContext) => void;

interface SkillSpec {
	/** Folder name under .claude/skills/. MUST equal the SKILL.md `name:` (VS Code
	 *  fails silently otherwise). Used as a fallback when the source has no frontmatter. */
	readonly name: string;
	readonly repo: string; // e.g. "anthropics/skills"
	readonly subpath: string; // path of the skill folder inside the repo ("." for repo root)
	readonly branch: string;
	readonly license: string;
	/** Append the install dir to <dest>/.gitignore instead of committing it. */
	readonly gitignore?: boolean;
	/** Drop these file extensions when copying (e.g. third-party scripts you don't want). */
	readonly dropExtensions?: readonly string[];
	/** Post-copy hook (vendoring, frontmatter injection, …). */
	readonly transform?: Transform;
}

interface McpSpec {
	readonly key: string;
	readonly config: Readonly<Record<string, unknown>>;
}

interface InstallContext {
	readonly dest: string;
	readonly dryRun: boolean;
}

const SKILLS: readonly SkillSpec[] = [
	{
		name: "frontend-design",
		repo: "anthropics/skills",
		subpath: "skills/frontend-design",
		branch: "main",
		license: "Apache-2.0",
	},
	{
		name: "webapp-testing",
		repo: "anthropics/skills",
		subpath: "skills/webapp-testing",
		branch: "main",
		license: "Apache-2.0",
	},
	{
		name: "skill-creator",
		repo: "anthropics/skills",
		subpath: "skills/skill-creator",
		branch: "main",
		license: "Apache-2.0",
	},
	{
		name: "shadcn",
		repo: "shadcn-ui/ui",
		subpath: "skills/shadcn",
		branch: "main",
		license: "MIT",
	},
	{
		name: "vercel-composition-patterns",
		repo: "vercel-labs/agent-skills",
		subpath: "skills/composition-patterns",
		branch: "main",
		license: "MIT",
	},
	{
		name: "web-design-guidelines",
		repo: "vercel-labs/agent-skills",
		subpath: "skills/web-design-guidelines",
		branch: "main",
		license: "MIT",
		// Upstream fetches its rules from a remote URL on every run (no version pin) —
		// a deferred prompt-injection surface. Vendor a pinned copy locally instead.
		transform: vendorWebDesignGuidelines,
	},
	{
		name: "systematic-debugging",
		repo: "obra/superpowers",
		subpath: "skills/systematic-debugging",
		branch: "main",
		license: "MIT",
		// Keep only the methodology markdown — drop the bisection scripts and the
		// plugin's session hooks (the full plugin auto-runs a SessionStart hook).
		dropExtensions: [".sh", ".ts"],
	},
	{
		name: "diagnose",
		repo: "mattpocock/skills",
		subpath: "skills/engineering/diagnose",
		branch: "main",
		license: "MIT",
	},
	{
		name: "grill-me",
		repo: "mattpocock/skills",
		subpath: "skills/productivity/grill-me",
		branch: "main",
		license: "MIT",
	},
	{
		name: "claude-a11y-skill",
		repo: "airowe/claude-a11y-skill",
		subpath: ".",
		branch: "main",
		license: "NONE (all rights reserved) — kept local, gitignored",
		gitignore: true,
		transform: hardenA11ySkill,
	},
];

const MCPS: readonly McpSpec[] = [
	{
		// Up-to-date library/framework docs on demand. Universal — great for Tauri (Rust + web).
		key: "Context7",
		config: { type: "stdio", command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] },
	},
	{
		// Drives a real browser (the "render + screenshot" half of the dynamic duo) as a
		// native tool. Complements webapp-testing for visual verification in any project.
		key: "playwright",
		config: { type: "stdio", command: "npx", args: ["@playwright/mcp@latest"] },
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// Transforms
// ─────────────────────────────────────────────────────────────────────────────

function vendorWebDesignGuidelines(skillDir: string, ctx: InstallContext): void {
	const guidelinesPath = join(skillDir, "guidelines.md");
	if (ctx.dryRun) {
		log(`  · would vendor guidelines.md (pinned, no remote fetch)`);
		return;
	}
	try {
		const tmp = gitSparse("vercel-labs/web-interface-guidelines", "main", ".");
		cpSync(join(tmp.root, "command.md"), guidelinesPath);
		rmSync(tmp.root, { recursive: true, force: true });
		const smd = join(skillDir, "SKILL.md");
		const body = readFileSync(smd, "utf8");
		const note =
			"\n> **Local install:** the upstream skill fetches its rules from a remote URL on every run\n" +
			"> (no version pin). This copy vendors them in `guidelines.md` next to this file — **read that,\n" +
			"> do NOT fetch remotely.** Re-vendor deliberately to update.\n";
		writeFileSync(smd, insertAfterFrontmatter(body, note), "utf8");
		log(`  · vendored guidelines.md + pinned note`);
	} catch (err) {
		log(
			`  · WARN could not vendor guidelines.md (${asMessage(err)}); skill still works via remote fetch`,
		);
	}
}

function hardenA11ySkill(skillDir: string, ctx: InstallContext): void {
	// Upstream file is `skill.md` (no frontmatter). Normalise + add required frontmatter
	// + a CDN-hardening note. (rename to SKILL.md already happened in installSkill.)
	const smd = join(skillDir, "SKILL.md");
	if (!existsSync(smd) || ctx.dryRun) {
		if (ctx.dryRun) log(`  · would add frontmatter + CDN-hardening note`);
		return;
	}
	const body = readFileSync(smd, "utf8");
	if (body.startsWith("---")) return; // already has frontmatter
	const frontmatter =
		"---\n" +
		"name: claude-a11y-skill\n" +
		'description: Run comprehensive accessibility (a11y / WCAG 2.1 AA) audits using axe-core (runtime) and eslint-plugin-jsx-a11y (static). Use when the user says "run accessibility scan", "a11y audit", "check accessibility", "WCAG compliance", or references /accessibility.\n' +
		"---\n\n" +
		"> **Hardening note (local install).** Prefer `node_modules/axe-core/axe.min.js` over the public\n" +
		"> CDN; treat any CDN fetch as untrusted (no secrets on the page under test). No upstream license —\n" +
		"> kept local and gitignored.\n\n";
	writeFileSync(smd, frontmatter + body, "utf8");
	log(`  · added frontmatter + CDN-hardening note`);
}

// ─────────────────────────────────────────────────────────────────────────────
// git helpers (sparse-checkout, blob:none — fetches only the skill folder)
// ─────────────────────────────────────────────────────────────────────────────

interface SparseClone {
	readonly root: string;
	readonly commit: string;
}

function gitSparse(repo: string, branch: string, subpath: string): SparseClone {
	const root = mkdtempSync(join(tmpdir(), "skset-"));
	const url = `https://github.com/${repo}.git`;
	execFileSync(
		"git",
		["clone", "--depth", "1", "--branch", branch, "--filter=blob:none", "--sparse", url, root],
		{ stdio: "pipe" },
	);
	if (subpath !== ".") {
		// NOTE: do NOT pass -q to sparse-checkout — some git builds reject it.
		execFileSync("git", ["-C", root, "sparse-checkout", "set", subpath], { stdio: "pipe" });
	}
	const commit = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], {
		encoding: "utf8",
	}).trim();
	return { root, commit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Install
// ─────────────────────────────────────────────────────────────────────────────

function installSkill(spec: SkillSpec, ctx: InstallContext): "installed" | "skipped" | "failed" {
	log(`\n▸ ${spec.name}  (${spec.repo} · ${spec.license})`);
	let clone: SparseClone;
	try {
		clone = gitSparse(spec.repo, spec.branch, spec.subpath);
	} catch (err) {
		log(`  ✗ clone failed: ${asMessage(err)}`);
		return "failed";
	}
	try {
		const srcDir = spec.subpath === "." ? clone.root : join(clone.root, spec.subpath);
		// Resolve the real folder name from the SKILL.md `name:` (fallback to spec.name).
		const resolvedName = readFrontmatterName(srcDir) ?? spec.name;
		const destDir = join(ctx.dest, ".claude", "skills", resolvedName);

		if (ctx.dryRun) {
			log(`  · would install -> .claude/skills/${resolvedName} (commit ${clone.commit})`);
			if (spec.dropExtensions?.length) log(`  · would drop: ${spec.dropExtensions.join(", ")}`);
			if (spec.gitignore) log(`  · would gitignore the folder`);
			spec.transform?.(destDir, ctx);
			return "installed";
		}

		rmSync(destDir, { recursive: true, force: true });
		mkdirSync(destDir, { recursive: true });
		cpSync(srcDir, destDir, {
			recursive: true,
			filter: (src) => !isDropped(src, spec.dropExtensions),
		});
		normaliseSkillFilename(destDir);
		writeSourceFile(destDir, spec, clone.commit);
		spec.transform?.(destDir, ctx);

		const finalName = readFrontmatterName(destDir) ?? resolvedName;
		if (finalName !== resolvedName) {
			// frontmatter injected a different name (a11y): rename the folder to match.
			const corrected = join(ctx.dest, ".claude", "skills", finalName);
			if (corrected !== destDir) {
				rmSync(corrected, { recursive: true, force: true });
				renameSync(destDir, corrected);
			}
		}
		if (spec.gitignore) addGitignore(ctx.dest, `.claude/skills/${finalName}/`);
		log(`  ✓ installed -> .claude/skills/${finalName} (commit ${clone.commit})`);
		return "installed";
	} catch (err) {
		log(`  ✗ install failed: ${asMessage(err)}`);
		return "failed";
	} finally {
		rmSync(clone.root, { recursive: true, force: true });
	}
}

function mergeMcp(ctx: InstallContext): void {
	const mcpPath = join(ctx.dest, ".mcp.json");
	const current: { mcpServers?: Record<string, unknown> } = existsSync(mcpPath)
		? JSON.parse(readFileSync(mcpPath, "utf8"))
		: {};
	const servers = current.mcpServers ?? {};
	const added: string[] = [];
	for (const mcp of MCPS) {
		if (servers[mcp.key]) {
			log(`  · ${mcp.key} already present — left untouched`);
			continue;
		}
		servers[mcp.key] = mcp.config;
		added.push(mcp.key);
	}
	current.mcpServers = servers;
	if (ctx.dryRun) {
		log(`  · would write .mcp.json adding: ${added.join(", ") || "(none)"}`);
		return;
	}
	writeFileSync(mcpPath, `${JSON.stringify(current, null, "\t")}\n`, "utf8");
	log(`  ✓ .mcp.json updated (added: ${added.join(", ") || "none"})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────────

function isDropped(src: string, dropExtensions?: readonly string[]): boolean {
	if (!dropExtensions?.length) return false;
	if (statSafe(src)?.isDirectory()) return false;
	return dropExtensions.some((ext) => src.endsWith(ext));
}

function statSafe(p: string): ReturnType<typeof statSync> | null {
	try {
		return statSync(p);
	} catch {
		return null;
	}
}

function normaliseSkillFilename(dir: string): void {
	const lower = join(dir, "skill.md");
	const upper = join(dir, "SKILL.md");
	if (existsSync(lower) && !existsSync(upper)) renameSync(lower, upper);
}

function readFrontmatterName(dir: string): string | null {
	for (const candidate of ["SKILL.md", "skill.md"]) {
		const p = join(dir, candidate);
		if (!existsSync(p)) continue;
		const text = readFileSync(p, "utf8");
		const match = text.match(/^---\s*[\s\S]*?\bname:\s*["']?([^"'\n]+)["']?/m);
		if (match) return match[1].trim();
	}
	return null;
}

function insertAfterFrontmatter(body: string, insert: string): string {
	if (!body.startsWith("---")) return insert + body;
	const end = body.indexOf("\n---", 3);
	if (end === -1) return insert + body;
	const cut = body.indexOf("\n", end + 1) + 1;
	return body.slice(0, cut) + insert + body.slice(cut);
}

function writeSourceFile(dir: string, spec: SkillSpec, commit: string): void {
	const content =
		`Source: https://github.com/${spec.repo}/tree/${spec.branch}/${spec.subpath}\n` +
		`Commit: ${commit}\n` +
		`License: ${spec.license}\n` +
		`Installed by setup-agent-skills.ts (no telemetry — pure git + fs).\n`;
	writeFileSync(join(dir, "SOURCE.md"), content, "utf8");
}

function addGitignore(dest: string, line: string): void {
	const giPath = join(dest, ".gitignore");
	const existing = existsSync(giPath) ? readFileSync(giPath, "utf8") : "";
	if (existing.split(/\r?\n/).includes(line)) return;
	const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	writeFileSync(giPath, `${existing}${prefix}${line}\n`, "utf8");
}

function asMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function log(msg: string): void {
	process.stdout.write(`${msg}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

interface Args {
	only: readonly string[] | null;
	noMcp: boolean;
	mcpOnly: boolean;
	dest: string;
	dryRun: boolean;
	list: boolean;
}

function parseArgs(argv: readonly string[]): Args {
	const args: Args = {
		only: null,
		noMcp: false,
		mcpOnly: false,
		dest: process.cwd(),
		dryRun: false,
		list: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--only")
			args.only = (argv[++i] ?? "")
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
		else if (a === "--no-mcp") args.noMcp = true;
		else if (a === "--mcp-only") args.mcpOnly = true;
		else if (a === "--dest") args.dest = argv[++i] ?? process.cwd();
		else if (a === "--dry-run") args.dryRun = true;
		else if (a === "--list") args.list = true;
		else if (a === "--help" || a === "-h") {
			printHelp();
			process.exit(0);
		} else {
			log(`Unknown argument: ${a}`);
			process.exit(1);
		}
	}
	return args;
}

function printHelp(): void {
	log("setup-agent-skills.ts — telemetry-free Agent Skills + MCP installer");
	log("  --only a,b   install only these skills");
	log("  --no-mcp     skip MCP merge        --mcp-only   only merge MCPs");
	log("  --dest DIR   target project root (default: cwd)");
	log("  --dry-run    print actions only    --list       print catalog");
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	if (args.list) {
		log("Portable skills:");
		for (const s of SKILLS) log(`  ${s.name.padEnd(28)} ${s.repo} (${s.license})`);
		log("MCP servers:");
		for (const m of MCPS) log(`  ${m.key}`);
		return;
	}

	// git availability check
	try {
		execFileSync("git", ["--version"], { stdio: "pipe" });
	} catch {
		log("ERROR: git is required but was not found on PATH.");
		process.exit(1);
	}

	const ctx: InstallContext = { dest: args.dest, dryRun: args.dryRun };
	mkdirSync(join(ctx.dest, ".claude", "skills"), { recursive: true });

	let installed = 0;
	let failed = 0;
	if (!args.mcpOnly) {
		const selected = args.only ? SKILLS.filter((s) => args.only?.includes(s.name)) : SKILLS;
		if (selected.length === 0) log("No matching skills for --only filter.");
		for (const spec of selected) {
			const result = installSkill(spec, ctx);
			if (result === "installed") installed++;
			else if (result === "failed") failed++;
		}
	}

	if (!args.noMcp) {
		log(`\n▸ MCP servers -> .mcp.json`);
		mergeMcp(ctx);
	}

	log(
		`\n${args.dryRun ? "[dry-run] " : ""}Done. ${installed} skill(s) installed, ${failed} failed.`,
	);
	log("Reminder: this installer never calls `npx skills` (no telemetry to add-skill.vercel.sh).");
	if (failed > 0) process.exit(1);
}

main();
