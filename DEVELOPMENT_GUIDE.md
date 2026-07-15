# N&D Companion — Development Guide

Practical workflow for building and verifying this Foundry VTT v14 module. Pair with `ARCHITECTURE.md` for how the code is structured.

---

## Prerequisites

- Foundry Virtual Tabletop **v14** (project targets Build 364+ / compatibility `"14"`)
- Git + GitHub access to `Mo0sel/nd-companion`
- A world where you can log in as **GM** (Scene Control launcher is GM-only)
- Optional: [The Forge](https://forge-vtt.com) host if you play / test there

Stack rules (do not violate):

- Plain JavaScript only
- Handlebars + ApplicationV2
- No React, TypeScript, Tailwind, or Vite in the Foundry module itself
- `design/figma-export/` is design reference only — Foundry does not load it

---

## How to run Foundry

### Local

1. Launch Foundry.
2. Ensure the `nd-companion` module is **installed** and **enabled** for your world.
3. Open a world as GM with at least one Scene (Scene Controls need a canvas).
4. Open DevTools **before** reload when debugging startup (`F12` or `Ctrl+Shift+I`).

**Local install tip:** Prefer a junction/symlink or copy of this repo into Foundry’s `Data/modules/nd-companion` so you edit the same files Foundry loads. If you keep two copies, you will debug the wrong tree.

Typical Windows Data path (depends on install):

```text
%localappdata%\FoundryVTT\Data\modules\nd-companion
```

Confirm Foundry is loading *this* checkout: change a `console.log` in `scripts/nd-companion.js`, hard refresh, and see it appear.

### The Forge

1. Open your Forge hosted world.
2. Module Management → confirm `N&D Companion` is enabled.
3. Forge pulls from the GitHub package (`module.json` `manifest` / `download` point at `main`).

After pushing to `main`, update the module on Forge (see below), then hard refresh the client.

---

## Git workflow

From the repo root (`nd-companion`):

### Status and diff

```powershell
git status
git diff
git log -5 --oneline
```

### Commit

Only commit when asked or when you intend to ship a milestone. Suggested flow:

```powershell
git status
git add -A
git commit -m "Short why-focused message"
git status
```

Bump `version` in `module.json` when you publish a Forge-facing build so clients can tell packages apart.

### Push

```powershell
git push origin HEAD
```

Remote default: `origin` → `https://github.com/Mo0sel/nd-companion` (`main`).

**Cache trap:** Pushing alone does not update a Forge world’s running code until Forge refreshes the package and the browser hard-reloads.

---

## How to update the module on Forge

Exact UI labels can change; the goal is always: **Forge serves the latest GitHub package, then the browser loads that build.**

1. Push commits to `main` (and bump `module.json` `version` if needed).
2. On Forge: open **Game Configuration** / **Module Management** for the world.
3. Find **N&D Companion** → **Update** / **Check for updates** / reinstall from manifest if Forge still shows an old version.
4. Confirm the listed version matches `module.json`.
5. Hard refresh the Foundry client (next section).
6. In Console, confirm bootstrap logs (`N&D Companion ready.`, `Entity Registry ready`).

If DevTools still shows old logs after update, the browser is caching the previous ESM bundle — hard refresh again or disable cache while DevTools is open.

---

## How to hard refresh Foundry

Foundry ESM modules cache aggressively. Soft reload (`F5`) is often not enough.

| Action | Shortcut (Windows) |
|--------|--------------------|
| Soft reload | `F5` / `Ctrl+R` |
| **Hard refresh** | `Ctrl+Shift+R` or `Ctrl+F5` |
| Close world and reopen | Most reliable after Forge update |
| DevTools → Network → **Disable cache** | Leave DevTools open while developing |

After code changes:

1. Save files.
2. If using Forge: update package first.
3. Hard refresh **or** return to setup and re-enter the world.
4. Confirm console marks a fresh boot.

---

## How to use DevTools

1. Open Foundry → press `F12` (or right-click → Inspect).
2. **Console** tab for module logs and exceptions.
3. Prefer opening DevTools **before** reload so early `init` / `ready` logs are not missed.
4. Filter by `N&D` or `Entity` if the log is noisy.
5. **Sources** / **Network**: check that `modules/nd-companion/scripts/*.js` return **200** and are not stale 304s from an old version when chasing “I edited the file but nothing changed.”

Red stack traces under `nd-companion` usually mean a syntax error on load — fix first; later hooks never run.

---

## How to use `window.nd` for debugging

On `ready`, bootstrap exposes:

```js
window.nd ??= {};
window.nd.EntityRegistry = EntityRegistry;
```

In the DevTools Console (after the world is ready):

```js
nd.EntityRegistry
nd.EntityRegistry.all("actor")
nd.EntityRegistry.all("scene")
nd.EntityRegistry.findByName("Exact Actor Name", "actor")
nd.EntityRegistry.findByUUID("Actor.xxxxxxx")
nd.EntityRegistry.search("The")
```

Useful checks:

| Check | Expectation |
|-------|-------------|
| `nd` is `undefined` | Module did not reach `ready`, wrong install path, or failed import |
| `all("actor").length` | Matches world Actors sidebar count (roughly) |
| Rename an Actor, call `all` again | Name updates (hooks rebuild that kind) |
| Two Actors same name | Both `ambiguous: true`; `findByName` → `status: "ambiguous"` |

Do not rely on `window.nd` in production UI code — it is a **development namespace**. Feature code should `import { EntityRegistry } from "./entity-registry.js"`.

---

## Typical smoke tests after each sprint

Run as GM in a world with a loaded Scene.

### Always

1. Console shows `N&D Companion initialized.` then `N&D Companion ready.` with **no** red errors from the module.
2. Token Scene Controls → **N&D Companion** opens the window (or focuses it).
3. Hard refresh once; window still opens.

### By area (run what you touched)

| Area | Smoke test |
|------|------------|
| **Campaign Context** | Switch Scene → bar Scene updates. Select one token → Focus name. Start combat → Combat/Round/Turn appear; end combat → they hide. |
| **Focus Panel** | No token → Party, no portrait. One token → portrait, name, type. |
| **Companion Memory** | Select actor → type note → wait for Saved → reselect / reload → note persists. No token → empty state message. |
| **Live Notes (Beat / Session)** | Notes workspace → edit Current Beat / Session Notes → Saved → reload → text persists. |
| **Workspaces** | Play / Notes / Prepare switch instantly. Type in Session Notes, switch to Play and back — text still there (show/hide, not remount). |
| **Entity Registry** | `nd.EntityRegistry.all("actor")` works. Create/rename/delete Actor → list changes without reload. |
| **Storage** | Confirm you did not introduce a second save path; UI still goes through `CompanionStorage` / `LiveNotes`. |

Record surprising UX in `UX_NOTES.md` after real sessions.

---

## Project conventions

These prevent the failures we have already paid for.

1. **Foundry is the source of truth**  
   Documents, tokens, combat, and canvas state live in Foundry. Companion stores only DM notes / settings (`CompanionStorage`).

2. **Engines before UI**  
   Put logic in small modules (`EntityRegistry`, `LiveNotes`, storage, context). UI paints and attaches; it does not own persistence or indexing.

3. **Hooks instead of polling**  
   No `setInterval` for world awareness. Use official V14 hooks (`controlToken`, `canvasReady`, combat hooks, document create/update/delete).

4. **Paint, don’t remount** for live chrome  
   Context / Focus updates should `paint` the open DOM. Full `render()` destroys contenteditable state and Live Notes listeners.

5. **Workspaces = show/hide**  
   Switching Play / Notes / Prepare must not re-render the whole app.

6. **Plain-text notes only**  
   Live Notes saves `textContent`. No HTML persistence. (Markdown preview is a future presentation layer — see `ROADMAP.md`.)

7. **UI never calls `game.settings` directly**  
   Always `CompanionStorage`.

8. **Official Foundry V14 APIs only**  
   ApplicationV2 + HandlebarsApplicationMixin. Do not invent canvas/settings APIs.

9. **GM cognitive load**  
   Before adding UI: “Does this reduce the DM’s cognitive load during a live session?” If not, simplify.

10. **Verify the loaded build**  
    After Forge/Git changes, hard refresh and confirm console + `module.json` version. Stale cache is the usual “ghost bug.”

---

## Quick reference

| Need | Do this |
|------|---------|
| Edit code | This repo (or Linked `Data/modules/nd-companion`) |
| Ship to Forge | Commit → push `main` → Forge update module → hard refresh |
| Inspect registry | `nd.EntityRegistry.all("actor")` |
| Architecture | `ARCHITECTURE.md` |
| Product direction | `PROJECT_VISION.md` |
| What’s next | `ROADMAP.md` |
