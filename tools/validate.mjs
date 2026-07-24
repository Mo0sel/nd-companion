#!/usr/bin/env node
/**
 * Project validation (syntax + imports + module integrity).
 *
 * Usage:
 *   npm run validate
 *   node tools/validate.mjs
 */

import { validateProject } from "./project-utils.mjs";

const result = validateProject();
console.log(`
Validation passed.
  Version: ${result.moduleJson.version}
  Entry:   ${result.graph.entry}
  Modules: ${result.graph.modules.length}
`);
