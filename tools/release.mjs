#!/usr/bin/env node
/**
 * N&D Companion release helper.
 *
 * module.json is the single source of truth for the current version.
 *
 * Usage:
 *   npm run release              → bump patch (0.3.33 → 0.3.34), then release
 *   npm run release -- 0.3.34    → release that exact version (override)
 *   node tools/release.mjs
 *   node tools/release.mjs 0.3.34
 *
 * Requires a clean working tree (commit sprint work first).
 * Updates module.json, commits, tags vX.Y.Z, pushes branch + tag.
 * GitHub Actions then builds module.zip and publishes the Release.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_JSON = join(ROOT, "module.json");
const REPO = "Mo0sel/nd-companion";
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const ZIP_FILENAME = "module.zip";
const MANIFEST_FILENAME = "module.json";
/** Directories whose .js / .mjs / .cjs files must parse before any release mutation. */
const SYNTAX_ROOTS = ["scripts", "tools"];

function fail(message) {
  console.error(`\nRelease aborted: ${message}\n`);
  process.exit(1);
}

function git(args, options = {}) {
  try {
    const out = execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
    });
    return typeof out === "string" ? out.trim() : "";
  } catch (error) {
    const detail = error.stderr?.toString?.().trim() || error.message;
    fail(`git ${args.join(" ")} failed\n${detail}`);
  }
}

function parseVersion(raw, label = "Version") {
  const value = String(raw ?? "").trim().replace(/^v/i, "");
  if (!VERSION_RE.test(value)) {
    fail(`${label} must look like 0.3.34 (got: ${raw ?? "(empty)"})`);
  }
  return value;
}

function bumpPatch(version) {
  const match = VERSION_RE.exec(version);
  if (!match) fail(`Cannot bump invalid version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function readModuleJson() {
  try {
    return JSON.parse(readFileSync(MODULE_JSON, "utf8"));
  } catch (error) {
    fail(`Could not read module.json\n${error.message}`);
  }
}

function expectedRelease(version) {
  const tag = `v${version}`;
  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  return {
    version,
    tag,
    releaseTitle: `N&D Companion ${version}`,
    zipFilename: ZIP_FILENAME,
    manifestFilename: MANIFEST_FILENAME,
    manifest: `${base}/${MANIFEST_FILENAME}`,
    download: `${base}/${ZIP_FILENAME}`,
    releaseUrl: `https://github.com/${REPO}/releases/tag/${tag}`,
    actionsUrl: `https://github.com/${REPO}/actions`
  };
}

function assertReleaseConsistency(data, expected) {
  const errors = [];

  if (data.version !== expected.version) {
    errors.push(
      `module.json version is ${JSON.stringify(data.version)}, expected ${JSON.stringify(expected.version)}`
    );
  }
  if (data.manifest !== expected.manifest) {
    errors.push(
      `manifest URL is ${JSON.stringify(data.manifest)}, expected ${JSON.stringify(expected.manifest)}`
    );
  }
  if (data.download !== expected.download) {
    errors.push(
      `download URL is ${JSON.stringify(data.download)}, expected ${JSON.stringify(expected.download)}`
    );
  }

  // Extra URL shape checks (catch wrong filename / tag segment)
  try {
    const manifestUrl = new URL(String(data.manifest ?? ""));
    const downloadUrl = new URL(String(data.download ?? ""));
    const manifestParts = manifestUrl.pathname.split("/").filter(Boolean);
    const downloadParts = downloadUrl.pathname.split("/").filter(Boolean);
    // .../releases/download/vX.Y.Z/module.json
    const manifestTag = manifestParts.at(-2);
    const downloadTag = downloadParts.at(-2);
    const manifestFile = manifestParts.at(-1);
    const downloadFile = downloadParts.at(-1);

    if (manifestTag !== expected.tag) {
      errors.push(
        `manifest URL tag segment is ${JSON.stringify(manifestTag)}, expected ${JSON.stringify(expected.tag)}`
      );
    }
    if (downloadTag !== expected.tag) {
      errors.push(
        `download URL tag segment is ${JSON.stringify(downloadTag)}, expected ${JSON.stringify(expected.tag)}`
      );
    }
    if (manifestFile !== expected.manifestFilename) {
      errors.push(
        `manifest filename is ${JSON.stringify(manifestFile)}, expected ${JSON.stringify(expected.manifestFilename)}`
      );
    }
    if (downloadFile !== expected.zipFilename) {
      errors.push(
        `download / ZIP filename is ${JSON.stringify(downloadFile)}, expected ${JSON.stringify(expected.zipFilename)}`
      );
    }
  } catch {
    errors.push("manifest or download URL is not a valid absolute URL");
  }

  // Derived release identity (must match GitHub Actions naming)
  if (expected.releaseTitle !== `N&D Companion ${expected.version}`) {
    errors.push(
      `release title drift: ${JSON.stringify(expected.releaseTitle)} does not match version ${expected.version}`
    );
  }
  if (expected.tag !== `v${expected.version}`) {
    errors.push(
      `git tag drift: ${JSON.stringify(expected.tag)} does not match version ${expected.version}`
    );
  }
  if (expected.zipFilename !== ZIP_FILENAME) {
    errors.push(
      `ZIP filename drift: ${JSON.stringify(expected.zipFilename)} (must be ${ZIP_FILENAME})`
    );
  }

  if (errors.length) {
    fail(
      "Release identity is inconsistent — all of these must match the same version:\n" +
        "  module.json version, manifest URL, download URL, git tag, release title, ZIP filename\n\n" +
        errors.map((line) => `  • ${line}`).join("\n")
    );
  }
}

function resolveTargetVersion(argv) {
  const extras = argv.slice(2).filter((arg) => arg !== "--");
  if (extras.length > 1) {
    fail(
      `Too many arguments: ${extras.join(" ")}\n` +
        "Usage:\n" +
        "  npm run release\n" +
        "  npm run release -- 0.3.34"
    );
  }

  const currentData = readModuleJson();
  const current = parseVersion(currentData.version, "module.json version");

  if (extras.length === 0) {
    const version = bumpPatch(current);
    return {
      version,
      previous: current,
      mode: "auto-patch",
      expected: expectedRelease(version)
    };
  }

  const version = parseVersion(extras[0], "Override version");
  return {
    version,
    previous: current,
    mode: "override",
    expected: expectedRelease(version)
  };
}

function assertCleanTree() {
  const status = git(["status", "--porcelain"]);
  if (status) {
    fail(
      "Working tree is not clean. Commit or stash sprint work first, then re-run.\n\n" +
        status
    );
  }
}

function listJavaScriptFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    fail(`Cannot read ${posixPath(dir)}: ${error.message}`);
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listJavaScriptFiles(full, acc);
      continue;
    }
    if (entry.isFile() && /\.(js|mjs|cjs)$/i.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function posixPath(absPath) {
  return relative(ROOT, absPath).split("\\").join("/") || ".";
}

/**
 * Fail closed: any parser error aborts before module.json writes, commits, tags, or pushes.
 */
function assertJavaScriptParses() {
  console.log("Syntax gate: validating JavaScript under scripts/ and tools/…");

  /** @type {string[]} */
  const files = [];
  for (const root of SYNTAX_ROOTS) {
    const abs = join(ROOT, root);
    try {
      if (!statSync(abs).isDirectory()) {
        fail(`Expected directory: ${root}/`);
      }
    } catch {
      fail(`Missing required directory: ${root}/`);
    }
    listJavaScriptFiles(abs, files);
  }

  files.sort((a, b) => posixPath(a).localeCompare(posixPath(b)));
  if (!files.length) {
    fail("No JavaScript files found under scripts/ or tools/.");
  }

  /** @type {{ file: string, error: string }[]} */
  const failures = [];
  for (const file of files) {
    const rel = posixPath(file);
    try {
      execFileSync(process.execPath, ["--check", file], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      const detail = [
        error.stderr?.toString?.().trim(),
        error.stdout?.toString?.().trim()
      ]
        .filter(Boolean)
        .join("\n")
        .trim();
      failures.push({
        file: rel,
        error: detail || error.message || "Unknown parser error"
      });
    }
  }

  if (failures.length) {
    const report = failures
      .map(
        (item) =>
          `  File: ${item.file}\n` +
          item.error
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n")
      )
      .join("\n\n");
    fail(
      `JavaScript syntax gate failed (${failures.length} file(s)).\n` +
        "No commit, tag, or push was created.\n\n" +
        report
    );
  }

  console.log(`Syntax gate passed (${files.length} file(s)).`);
}

function assertTagAvailable(tag) {
  const local = git(["tag", "-l", tag]);
  if (local) fail(`Tag ${tag} already exists locally.`);

  try {
    const remote = execFileSync("git", ["ls-remote", "--tags", "origin", tag], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    if (remote) fail(`Tag ${tag} already exists on origin.`);
  } catch (error) {
    const detail = error.stderr?.toString?.().trim() || "";
    if (/already exists/i.test(detail)) fail(detail);
  }
}

function writeModuleJson(version, expected) {
  const data = readModuleJson();
  data.version = version;
  data.manifest = expected.manifest;
  data.download = expected.download;
  writeFileSync(MODULE_JSON, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  const written = readModuleJson();
  assertReleaseConsistency(written, expected);
  return written;
}

function printSummary({ mode, previous, branch, expected }) {
  const modeLabel =
    mode === "auto-patch"
      ? `auto-patch (${previous} → ${expected.version})`
      : `override (was ${previous})`;

  console.log(`
Release summary
---------------
Mode:            ${modeLabel}
Version:         ${expected.version}
Git tag:         ${expected.tag}
Release title:   ${expected.releaseTitle}
ZIP asset:       ${expected.zipFilename}
Manifest URL:    ${expected.manifest}
Download URL:    ${expected.download}
Branch:          ${branch}
Commit message:  Release ${expected.tag}
Release URL:     ${expected.releaseUrl}
`);
}

function main() {
  const { version, previous, mode, expected } = resolveTargetVersion(process.argv);
  const { tag } = expected;

  console.log(`Preparing N&D Companion ${tag}`);

  assertCleanTree();
  assertTagAvailable(tag);
  // Before any mutation: refuse to release unparseable JS (Foundry load-breakers).
  assertJavaScriptParses();

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch || branch === "HEAD") {
    fail("Detached HEAD — check out a branch before releasing.");
  }

  writeModuleJson(version, expected);
  printSummary({ mode, previous, branch, expected });

  git(["add", "module.json"]);
  const staged = git(["diff", "--cached", "--name-only"]);
  if (staged) {
    git(["commit", "-m", `Release ${tag}`], { stdio: "inherit" });
  } else if (mode === "override" && previous === version) {
    console.log(
      "module.json already matched this version — skipping commit, tagging current HEAD."
    );
  } else {
    fail(
      "module.json did not change after write (unexpected). Refusing to tag an inconsistent tree."
    );
  }

  // Re-validate from disk immediately before tag/push
  assertReleaseConsistency(readModuleJson(), expected);

  git(["tag", "-a", tag, "-m", expected.releaseTitle]);
  console.log(`Created annotated tag ${tag} (${expected.releaseTitle})`);

  console.log("Pushing branch and tag…");
  git(["push", "-u", "origin", "HEAD"], { stdio: "inherit" });
  git(["push", "origin", tag], { stdio: "inherit" });

  console.log(`
Release pushed successfully.

GitHub Release:  ${expected.releaseUrl}
GitHub Actions:  ${expected.actionsUrl}

When the Action is green, Forge/Foundry can install from:
  ${expected.manifest}
`);
}

main();
