#!/usr/bin/env node
/**
 * Local development package — no version bump, git, tag, push, or GitHub Release.
 *
 * Usage:
 *   npm run dev-build
 *   node tools/dev-build.mjs
 *
 * Output:
 *   build/module.json
 *   build/module.zip
 */

import { writeDevPackage } from "./package-module.mjs";
import { BUILD_DIR, posixPath, validateProject } from "./project-utils.mjs";

console.log("N&D Companion — development build\n");

validateProject();
const built = writeDevPackage({ outDir: BUILD_DIR });

console.log(`
Dev build ready (no git / no release).

  Folder:    ${posixPath(built.outDir)}/
  Manifest:  ${posixPath(built.manifestPath)}
  Package:   ${posixPath(built.zipPath)}
  Version:   ${built.version} (unchanged)
  Files:     ${built.fileCount}
  Zip size:  ${built.bytes} bytes

Install / test in Foundry:
  1. Copy build/module.zip contents into your Foundry Data/modules/nd-companion/
     (or point a local module folder at this repo and refresh).
  2. Hard refresh Foundry (Ctrl+Shift+R).
  3. Verify in the console:
       window.nd
       window.nd.PromptBuilder
       window.nd.AIProviderRegistry
       window.nd.ToolRegistry
       window.nd.AISettings
`);
