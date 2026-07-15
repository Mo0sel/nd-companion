# N&D Companion — Architecture

Foundry VTT **v14** module (`nd-companion`). Plain JavaScript, Handlebars, ApplicationV2. No React/TypeScript/Tailwind.

This document describes **what exists today**. Read it top to bottom; skip `design/` (Figma export reference only — not loaded by Foundry).

---

## Overall architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Foundry V14 Client                        │
│  Actors · Scenes · Journals · RollTables · Tokens · Combat │
│  game.settings (world) · Hooks · Scene Controls               │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Bootstrap                │    │  Engines (plain JS modules)   │
│  scripts/nd-companion.js  │───▶│  CompanionStorage             │
│  init / ready / controls  │    │  LiveNotes                    │
│                           │    │  CampaignContext + Awareness  │
│  window.nd.* (dev)        │◀───│  FocusManager + FocusPanel    │
│  EntityRegistry ·         │    │  Navigation                   │
│  FocusManager · Navigation│    │  EntityRegistry               │
└─────────────┬────────────┘    └──────────────┬──────────────┘
              │                                │
              ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│  UI — CompanionApp (ApplicationV2 + Handlebars)               │
│  templates/companion.hbs · styles/nd-companion.css            │
│                                                               │
│  Chrome (always visible)                                      │
│    Campaign Context · Focus Panel · Workspace switcher         │
│  Workspaces (show/hide; no remount)                           │
│    Play · Notes · Prepare                                     │
└─────────────────────────────────────────────────────────────┘
```

**Single entry:** `module.json` → `scripts/nd-companion.js` (ESM). Everything else is imported from there or from `CompanionApp`.

---

## Key files

| Path | Role |
|------|------|
| `module.json` | Module manifest |
| `scripts/nd-companion.js` | Bootstrap: settings, hooks, Scene Control button, `window.nd` |
| `scripts/companion-app.js` | `CompanionApp` window + workspaces |
| `scripts/storage.js` | `CompanionStorage` |
| `scripts/live-notes.js` | `LiveNotes` |
| `scripts/campaign-context.js` | `CampaignContext` + `CampaignAwareness` |
| `scripts/focus-manager.js` | `FocusManager` — focus state and resolution |
| `scripts/focus-panel.js` | `FocusPanel` — focus panel render + Companion Memory wiring |
| `scripts/navigation.js` | `Navigation` — navigate to entities |
| `scripts/entity-registry.js` | `EntityRegistry` |
| `templates/companion.hbs` | Window markup |
| `styles/nd-companion.css` | Styles |

---

## Engines and responsibilities

### CompanionStorage (`storage.js`)

World persistence. **UI must not call `game.settings` directly.**

| Setting | Scope | Type | Purpose |
|---------|--------|------|---------|
| `currentBeat` | world | String | Current Beat live note |
| `sessionNotes` | world | String | Session Notes live note |
| `campaignMemory` | world | Object | Map of `kind:uuid` → note text |

Registered during `init`.

### LiveNotes (`live-notes.js`)

Click-to-edit contenteditable regions: load → 500ms debounce autosave → Saving… / Saved status.

- Default: `CompanionStorage.get` / `set`
- `{ memory: true }`: `getMemory` / `setMemory`
- `attach` / `detach`; re-attach replaces prior listeners

Persists **plain text** (`textContent`) only.

### CampaignContext + CampaignAwareness (`campaign-context.js`)

| Class | Role |
|-------|------|
| `CampaignContext` | Snapshot: scene name, focus label (from `FocusManager.get()`), combat round/turn |
| `CampaignAwareness` | Paints snapshot into DOM; refreshes open Companion via Foundry hooks |

Read-only. No persistence.

### FocusManager (`focus-manager.js`)

| Concern | Behavior |
|---------|----------|
| Focus model | Canvas token (single controlled) → logical focus (ephemeral UUID) → `party` |
| Logical focus | Set by `Navigation` when actor has no token on current scene; cleared on `controlToken` |
| Refresh | `refreshOpen()` paints Campaign Context + Focus Panel on open Companion |

No persistence. Hooks: `controlToken`, `updateActor`, `deleteActor`, `canvasReady`.

### FocusPanel (`focus-panel.js`)

Render-only. Paints portrait / name / type from a focus model supplied by `FocusManager`.

| Concern | Behavior |
|---------|----------|
| Paint | Portrait / name / type; party hides portrait+type |
| Companion Memory | Actor → `LiveNotes.attach(..., { memory: true })` with key `actor:<uuid>`; party → empty state |

### Navigation (`navigation.js`)

Single navigation layer for opening or focusing Foundry entities. Uses `EntityRegistry` entities. No persistence. No UI.

| Method | Role |
|--------|------|
| `canNavigate(entity)` | Preflight boolean for future UI |
| `navigate(entity)` | Actor: token control or logical focus; Scene: `view()`; Journal/RollTable: sheet |

Kinds: `actor`, `scene`, `journal`, `rollTable`.

### EntityRegistry (`entity-registry.js`)

Runtime index of world documents. **No persistence.**

Kinds: `actor`, `scene`, `journal`, `rollTable`.

Each entry: `{ uuid, id, kind, name, img, document, ambiguous }`.

Built on `ready`; per-kind rebuild on create/update/delete hooks. Exact name / prefix search (case-sensitive); same-kind name collisions → `ambiguous: true`.

Scene `img` uses official V14 `Scene.thumbnail` (fallback `thumb`) — not deprecated `Scene.background`.

### CompanionApp (`companion-app.js`)

ApplicationV2 + HandlebarsApplicationMixin window (`id: nd-companion-app`).

- Template: `templates/companion.hbs`
- Workspaces: `play` \| `notes` \| `prepare` via `setWorkspace()` (show/hide; no full re-render)
- `_onRender`: apply workspace → paint Context → paint Focus → attach Live Notes on `[data-storage]` (except memory editor)

---

## UI components and engine dependencies

```
CompanionApp
├── Campaign Context bar ────────── CampaignContext.get + CampaignAwareness.paint
├── Focus Panel ─────────────────── FocusManager.get → FocusPanel.paint
├── Workspace switcher ──────────── CompanionApp.setWorkspace (instance state only)
├── Play
│   ├── Companion Memory ────────── FocusPanel → LiveNotes + CompanionStorage (memory)
│   ├── Open Threads ────────────── Static markup (no engine)
│   └── OH SHIT! ────────────────── Static button (no behavior)
├── Notes
│   ├── Session Notes ───────────── LiveNotes + CompanionStorage (`sessionNotes`)
│   ├── Current Beat ────────────── LiveNotes + CompanionStorage (`currentBeat`)
│   └── Next Scene ──────────────── Static markup (no engine)
└── Prepare ─────────────────────── Placeholder card (no engine)
```

**Launcher:** Token Scene Controls tool “N&D Companion” (GM) → open/focus `CompanionApp`.

---

## Data flow

```
Foundry world state
  │
  ├─ document collections ──hooks──▶ EntityRegistry (runtime index)
  │                                    └─ window.nd.EntityRegistry (dev)
  │
  ├─ Navigation.navigate(entity) ─────▶ canvas / sheets / FocusManager
  │
  ├─ canvas / combat / tokens ─hooks──▶ CampaignAwareness ──paint──▶ Context bar
  │                              hooks──▶ FocusManager ──paint──▶ Focus + Memory
  │
  └─ game.settings (world)
         ▲
         │ CompanionStorage
         │
         LiveNotes.attach / autosave
         ▲
         contenteditable regions in CompanionApp
```

**Refresh rule:** awareness/focus hooks **paint DOM** on the open app; they do not remount the whole Application (workspace editors keep state).

---

## Public APIs

### CompanionStorage

```js
CompanionStorage.register()
CompanionStorage.get(key)            // → string
CompanionStorage.set(key, value)     // → Promise
CompanionStorage.getMemory(key)      // → string
CompanionStorage.setMemory(key, value) // → Promise
```

### LiveNotes

```js
LiveNotes.attach(element, key, { memory?: boolean })
LiveNotes.detach(element)
```

### CampaignContext / CampaignAwareness

```js
CampaignContext.get()                // → { scene, focus, combat }
CampaignAwareness.paint(root, context)
CampaignAwareness.registerHooks()
```

### FocusManager

```js
FocusManager.get()                   // → party | actor model
FocusManager.setLogicalFocus(uuid)
FocusManager.clearLogicalFocus()
FocusManager.refreshOpen()
FocusManager.registerHooks()
```

### FocusPanel

```js
FocusPanel.memoryKey(kind, uuid)     // → "kind:uuid"
FocusPanel.paint(root, model)
```

### Navigation

```js
Navigation.canNavigate(entity)       // → boolean
Navigation.navigate(entity)          // → Promise<NavigationResult>
```

### EntityRegistry

```js
EntityRegistry.ready()
EntityRegistry.registerHooks()
EntityRegistry.findByUUID(uuid)      // → entity | null
EntityRegistry.findByName(name, kind?)
  // → { status: "ok", entity }
  // | { status: "missing" }
  // | { status: "ambiguous", entities }
EntityRegistry.all(kind)             // → entity[]
EntityRegistry.search(prefix, kind?) // case-sensitive prefix
```

### CompanionApp

```js
new CompanionApp().render({ force: true })
app.setWorkspace("play" | "notes" | "prepare")
// Action: data-action="setWorkspace" data-workspace="..."
```

---

## Lifecycle

1. **`init`** — log; `CompanionStorage.register()`
2. **`ready`** — `EntityRegistry.ready()` + hooks; expose `window.nd`; awareness + focus hooks (`FocusManager`)
3. **`getSceneControlButtons`** — register Companion tool on Token controls
4. **Open window** — render template; paint; attach Live Notes

---

## Developer namespace

Exposed on `ready` for DevTools (development convenience):

```js
window.nd ??= {};
window.nd.EntityRegistry = EntityRegistry;
window.nd.FocusManager = FocusManager;
window.nd.Navigation = Navigation;
```

Examples:

```js
nd.EntityRegistry.all("actor")
nd.FocusManager.get()

// Prefer a real Actor name from this world (not a placeholder like "NPC NAME")
const name = nd.EntityRegistry.all("actor")[0]?.name;
const found = nd.EntityRegistry.findByName(name, "actor");
if (found.status === "ok") {
  nd.Navigation.canNavigate(found.entity);
  await nd.Navigation.navigate(found.entity);
}
```

---

## Conventions that matter for new work

1. **Foundry is source of truth** for documents and live canvas/combat state.
2. **CompanionStorage** is the only settings wrapper UI may use.
3. **Live Notes** is the only contenteditable autosave engine; notes are plain text.
4. **Paint, don’t remount** for live chrome updates; workspaces use show/hide.
5. **EntityRegistry + Navigation** — registry indexes entities; Navigation is the single go-to layer for consumers.
