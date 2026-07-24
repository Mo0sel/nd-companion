# N&D Companion — Releases

One-minute guide to shipping a Foundry-ready build.

## How it works

```text
npm run release
        ↓
Read version from module.json (source of truth)
        ↓
Bump patch (or use -- X.Y.Z override)
        ↓
Syntax gate: node --check every .js/.mjs under scripts/ and tools/
        ↓
Rewrite module.json version + manifest/download URLs
        ↓
Validate: version ≡ tag ≡ URLs ≡ release title ≡ module.zip
        ↓
Print summary → commit → tag → push branch + tag
        ↓
GitHub Action (.github/workflows/release.yml)
        ↓
GitHub Release: module.json + module.zip
        ↓
Forge / Foundry → Update module
```

No manual GitHub UI steps. The Action builds a **flat** `module.zip` containing only:

`module.json`, `scripts/`, `styles/`, `templates/`, `lang/`, and `assets/` if present.

## Prerequisites

1. Sprint / feature work is already **committed** (working tree clean).
2. Node.js 18+.
3. Push access to `origin`.

## Publish

### Default (auto patch bump)

`module.json` is the source of truth. This bumps the patch and releases:

```bash
npm run release
```

Example: `0.3.34` in `module.json` → releases `0.3.35` / tag `v0.3.35`.

### Explicit version (override)

```bash
npm run release -- 0.3.35
```

Use this for minor/major bumps, or to tag a version already written in `module.json`.

## What the script checks

### Syntax gate (before any commit/tag/push)

Every `.js` / `.mjs` / `.cjs` file under `scripts/` and `tools/` is parsed with `node --check`.

If **any** file fails:

- the filename and parser error are printed
- the release **aborts**
- **no** `module.json` write / commit / tag / push is performed

### Version identity

Before pushing, everything must agree on the same `X.Y.Z`:

| Artifact | Must be |
|----------|---------|
| `module.json` `version` | `X.Y.Z` |
| Git tag | `vX.Y.Z` |
| Release title | `N&D Companion X.Y.Z` |
| ZIP asset name | `module.zip` |
| `manifest` | `…/releases/download/vX.Y.Z/module.json` |
| `download` | `…/releases/download/vX.Y.Z/module.zip` |

Any mismatch aborts with a clear error. A short summary is printed before push; the GitHub Release URL is printed after.

## After the command succeeds

1. Open the printed **GitHub Release** / **Actions** URLs; wait for green.
2. On Forge: Module Management → **Update** N&D Companion.
3. Hard refresh Foundry (`Ctrl+Shift+R`).

Never use `…/archive/refs/heads/main.zip` for installs.

## Cursor / “Finish Sprint”

A sprint is **not complete** until `npm run release` (or an explicit override) has succeeded.

See `.cursor/rules/release-workflow.mdc`.
