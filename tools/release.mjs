#!/usr/bin/env node
/**
 * N&D Companion release helper.
 *
 * module.json is the single source of truth for the current version.
 *
 * Usage:
 *   npm run release              → bump patch, then release
 *   npm run release -- 0.3.36    → release that exact version (override)
 *
 * Requires a clean working tree (commit sprint work first).
 * Updates module.json, commits, tags vX.Y.Z, pushes branch + tag.
 * GitHub Actions then builds module.zip and publishes the Release.
 *
 * For local Foundry testing without a release, use: npm run dev-build
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  MODULE_JSON,
  REPO,
  ROOT,
  fail,
  readModuleJson,
  validateProject
} from "./project-utils.mjs";

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const ZIP_FILENAME = "module.zip";
const MANIFEST_FILENAME = "module.json";

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
    fail(`${label} must look like 0.3.36 (got: ${raw ?? "(empty)"})`);
  }
  return value;
}

function bumpPatch(version) {
  const match = VERSION_RE.exec(version);
  if (!match) fail(`Cannot bump invalid version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
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

  try {
    const manifestUrl = new URL(String(data.manifest ?? ""));
    const downloadUrl = new URL(String(data.download ?? ""));
    const manifestParts = manifestUrl.pathname.split("/").filter(Boolean);
    const downloadParts = downloadUrl.pathname.split("/").filter(Boolean);
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
        "  npm run release -- 0.3.36"
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

function printPostReleaseChecklist(expected) {
  console.log(`
Release pushed successfully.

GitHub Release:  ${expected.releaseUrl}
Manifest URL:    ${expected.manifest}
Download URL:    ${expected.download}
GitHub Actions:  ${expected.actionsUrl}

When the Action is green:
  1. Forge / Foundry → Update N&D Companion
  2. Hard refresh Foundry (Ctrl+Shift+R)
  3. Runtime verification (console):
       window.nd
       window.nd.PromptBuilder
       window.nd.AIProviderRegistry
       window.nd.ToolRegistry
       window.nd.AISettings
`);
}

function main() {
  const { version, previous, mode, expected } = resolveTargetVersion(process.argv);
  const { tag } = expected;

  console.log(`Preparing N&D Companion ${tag}`);

  assertCleanTree();
  assertTagAvailable(tag);
  validateProject();

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

  assertReleaseConsistency(readModuleJson(), expected);

  git(["tag", "-a", tag, "-m", expected.releaseTitle]);
  console.log(`Created annotated tag ${tag} (${expected.releaseTitle})`);

  console.log("Pushing branch and tag…");
  git(["push", "-u", "origin", "HEAD"], { stdio: "inherit" });
  git(["push", "origin", tag], { stdio: "inherit" });

  printPostReleaseChecklist(expected);
}

main();
