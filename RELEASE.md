# N&D Companion — Build & Release

## Two different commands

| Phrase | Meaning | GitHub Release? |
|--------|---------|-----------------|
| **Finish Sprint** | Validate + local test package + checklist | No |
| **Release Sprint** / **Release vX.Y.Z** | Version bump + tag + push + GitHub Release | Yes |

Do not release every sprint just to test in Foundry. Use a **dev build** first.

---

## Local development build

```bash
npm run dev-build
```

This will:

1. Run syntax validation (`scripts/` + `tools/`)
2. Walk the static import graph from `module.json` → `esmodules`
3. Check module integrity (required files, styles, languages, `window.nd` AI exports)
4. Write a Foundry package into **`build/`**

Output:

```text
build/module.json
build/module.zip
```

It does **not**:

- change the version
- commit
- tag
- push
- create a GitHub Release

### Install the dev build in Foundry

1. Unpack `build/module.zip` into `Data/modules/nd-companion/` (flat root — `module.json` at the top).
2. Or develop against this repo folder as the module directory.
3. Hard refresh Foundry (`Ctrl+Shift+R`).

---

## Finish Sprint (no release)

When you say **Finish Sprint**, Cursor should:

1. Run `npm run validate` (or `npm run dev-build`)
2. Confirm syntax, imports, and module integrity pass
3. Print a sprint testing checklist (see below)
4. **Stop** — no version bump, no tag, no GitHub Release

### Sprint testing checklist (template)

- [ ] `npm run validate` passes
- [ ] `npm run dev-build` produces `build/module.zip`
- [ ] Foundry loads the module without console SyntaxErrors
- [ ] Companion button appears for the GM
- [ ] Runtime APIs (as applicable to the sprint):

```js
window.nd
window.nd.PromptBuilder
window.nd.AIProviderRegistry
window.nd.ToolRegistry
window.nd.AISettings
```

- [ ] Feature-specific checks for this sprint are listed by Cursor and verified

---

## Release Sprint (GitHub Release)

Only when you explicitly say **Release Sprint**, **Release vX.Y.Z**, or **Publish**:

```bash
npm run release
# or
npm run release -- 0.3.36
```

Flow:

```text
Validate (syntax + imports + integrity)
        ↓
Bump / set version in module.json
        ↓
Commit + tag vX.Y.Z + push branch + tag
        ↓
GitHub Action builds module.zip
        ↓
GitHub Release assets published
        ↓
Forge / Foundry → Update module
```

`module.json` remains the version source of truth.

### After release (printed by the script)

- GitHub Release URL
- Manifest URL
- Download URL
- Runtime verification checklist (`window.nd.*`)

---

## Validation details

| Gate | What it checks |
|------|----------------|
| Syntax | `node --check` on every `.js`/`.mjs`/`.cjs` under `scripts/` and `tools/` |
| Imports | Static relative import graph from the module entry resolves |
| Integrity | Required folders/files, style/lang paths, `window.nd` AI assignments |

Any failure aborts. Releases never mutate git if validation fails.

---

## Cursor rules

See `.cursor/rules/release-workflow.mdc`.
