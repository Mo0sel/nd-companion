/**
 * Shared paths and helpers for N&D Companion tooling.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MODULE_JSON = join(ROOT, "module.json");
export const BUILD_DIR = join(ROOT, "build");
export const REPO = "Mo0sel/nd-companion";
export const SYNTAX_ROOTS = ["scripts", "tools"];
export const PACKAGE_DIRS = ["scripts", "styles", "templates", "lang"];
export const PACKAGE_OPTIONAL_DIRS = ["assets"];

export function fail(message, code = 1) {
  console.error(`\n${message}\n`);
  process.exit(code);
}

export function posixPath(absPath) {
  return relative(ROOT, absPath).split("\\").join("/") || ".";
}

export function readModuleJson() {
  try {
    return JSON.parse(readFileSync(MODULE_JSON, "utf8"));
  } catch (error) {
    fail(`Could not read module.json\n${error.message}`);
  }
}

export function listJavaScriptFiles(dir, acc = []) {
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

export function listFilesRecursive(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    fail(`Cannot read ${posixPath(dir)}: ${error.message}`);
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(full, acc);
      continue;
    }
    if (entry.isFile()) acc.push(full);
  }
  return acc;
}

export function assertDir(rel) {
  const abs = join(ROOT, rel);
  try {
    if (!statSync(abs).isDirectory()) fail(`Expected directory: ${rel}/`);
  } catch {
    fail(`Missing required directory: ${rel}/`);
  }
  return abs;
}

/**
 * Parse every JS file under scripts/ and tools/.
 * @returns {number} file count
 */
export function assertJavaScriptParses() {
  console.log("Syntax gate: validating JavaScript under scripts/ and tools/…");

  /** @type {string[]} */
  const files = [];
  for (const root of SYNTAX_ROOTS) {
    listJavaScriptFiles(assertDir(root), files);
  }

  files.sort((a, b) => posixPath(a).localeCompare(posixPath(b)));
  if (!files.length) fail("No JavaScript files found under scripts/ or tools/.");

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
      `JavaScript syntax gate failed (${failures.length} file(s)).\n\n${report}`
    );
  }

  console.log(`Syntax gate passed (${files.length} file(s)).`);
  return files.length;
}

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^"'();]+?\s+from\s+)?["'](\.[^"']+)["']/g;

/**
 * Walk static relative imports from module.json esmodules entry.
 * @returns {{ entry: string, modules: string[] }}
 */
export function assertImportGraph() {
  console.log("Import gate: walking static imports from module entry…");
  const data = readModuleJson();
  const entries = Array.isArray(data.esmodules) ? data.esmodules : [];
  if (!entries.length) fail('module.json is missing "esmodules".');

  const entryRel = String(entries[0]).replace(/^\.\//, "");
  const entryAbs = resolve(ROOT, entryRel);
  try {
    if (!statSync(entryAbs).isFile()) fail(`Entry module missing: ${entryRel}`);
  } catch {
    fail(`Entry module missing: ${entryRel}`);
  }

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const queue = [entryAbs];
  /** @type {string[]} */
  const missing = [];

  while (queue.length) {
    const current = queue.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    let source;
    try {
      source = readFileSync(current, "utf8");
    } catch (error) {
      missing.push(`${posixPath(current)} (unreadable: ${error.message})`);
      continue;
    }

    IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_RE.exec(source))) {
      let spec = match[1];
      if (!spec.startsWith(".")) continue;
      if (!/\.(js|mjs|cjs)$/i.test(spec)) spec = `${spec}.js`;
      const resolved = resolve(dirname(current), spec);
      try {
        if (!statSync(resolved).isFile()) {
          missing.push(`${posixPath(current)} → ${spec}`);
          continue;
        }
      } catch {
        missing.push(`${posixPath(current)} → ${spec}`);
        continue;
      }
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }

  if (missing.length) {
    fail(
      `Import graph is broken (${missing.length} missing file(s)):\n` +
        missing.map((line) => `  • ${line}`).join("\n")
    );
  }

  const modules = [...seen].map(posixPath).sort();
  console.log(`Import gate passed (${modules.length} module(s) from ${entryRel}).`);
  return { entry: entryRel, modules };
}

/**
 * Validate module.json shape and required package folders/files.
 */
export function assertModuleIntegrity() {
  console.log("Integrity gate: checking module.json and package layout…");
  const data = readModuleJson();
  /** @type {string[]} */
  const errors = [];

  if (data.id !== "nd-companion") {
    errors.push(`module.json id must be "nd-companion" (got ${JSON.stringify(data.id)})`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(String(data.version ?? ""))) {
    errors.push(`module.json version must look like X.Y.Z (got ${JSON.stringify(data.version)})`);
  }
  if (!Array.isArray(data.esmodules) || !data.esmodules.length) {
    errors.push('module.json must declare "esmodules"');
  }
  if (!Array.isArray(data.styles) || !data.styles.length) {
    errors.push('module.json must declare "styles"');
  }

  for (const rel of PACKAGE_DIRS) {
    try {
      if (!statSync(join(ROOT, rel)).isDirectory()) errors.push(`Missing ${rel}/`);
    } catch {
      errors.push(`Missing ${rel}/`);
    }
  }

  const requiredFiles = [
    "scripts/nd-companion.js",
    "lang/en.json",
    "templates/companion.hbs"
  ];
  for (const rel of requiredFiles) {
    try {
      if (!statSync(join(ROOT, rel)).isFile()) errors.push(`Missing ${rel}`);
    } catch {
      errors.push(`Missing ${rel}`);
    }
  }

  for (const rel of data.esmodules ?? []) {
    try {
      if (!statSync(join(ROOT, rel)).isFile()) errors.push(`esmodules entry missing: ${rel}`);
    } catch {
      errors.push(`esmodules entry missing: ${rel}`);
    }
  }
  for (const rel of data.styles ?? []) {
    try {
      if (!statSync(join(ROOT, rel)).isFile()) errors.push(`styles entry missing: ${rel}`);
    } catch {
      errors.push(`styles entry missing: ${rel}`);
    }
  }
  for (const lang of data.languages ?? []) {
    const path = lang?.path;
    if (!path) {
      errors.push("languages entry missing path");
      continue;
    }
    try {
      if (!statSync(join(ROOT, path)).isFile()) {
        errors.push(`language file missing: ${path}`);
      }
    } catch {
      errors.push(`language file missing: ${path}`);
    }
  }

  // Developer API surface expected after ready (Sprint 13+)
  const entrySource = readFileSync(join(ROOT, "scripts/nd-companion.js"), "utf8");
  for (const name of [
    "PromptBuilder",
    "AIProviderRegistry",
    "ToolRegistry",
    "AISettings",
    "ContextSerializer",
    "CampaignCopilot"
  ]) {
    if (!entrySource.includes(`window.nd.${name}`)) {
      errors.push(`scripts/nd-companion.js does not assign window.nd.${name}`);
    }
  }

  if (errors.length) {
    fail(
      `Module integrity failed (${errors.length}):\n` +
        errors.map((line) => `  • ${line}`).join("\n")
    );
  }

  console.log("Integrity gate passed.");
  return data;
}

/**
 * Run all project validation gates (no git, no packaging).
 */
export function validateProject() {
  assertJavaScriptParses();
  const graph = assertImportGraph();
  const moduleJson = assertModuleIntegrity();
  return { graph, moduleJson };
}
