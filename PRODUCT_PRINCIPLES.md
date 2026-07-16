# N&D Companion — Product Principles

Every feature must be measurable against these principles.  
This is philosophy, not a roadmap. If a proposal fails a principle, redesign it before shipping.

---

## 1. Foundry is the source of truth

Actors, Scenes, Journals, Roll Tables, Tokens, Combat, and sheet data live in Foundry.

The Companion may **observe**, **index**, and **annotate**. It must not become a second database of the same facts.

**Test:** Can the player delete Companion notes and still run the campaign from Foundry alone? If not, we owned something we shouldn’t.

---

## 2. Never duplicate maintenance

If the DM must update the same fact in Foundry *and* in Companion, the design is wrong.

Companion Memory and Live Notes hold **DM judgment** (secrets, focus, session capture)—not HP, inventory, or sheet fields Foundry already owns.

**Test:** Does this feature create a second place the DM must keep in sync? Ship zero of those.

---



## 3. Reduce cognitive load

The Companion is a second brain, not a second project.

Prefer fewer surfaces, clearer defaults, and less to remember mid-session. Features that add options without removing thought fail this principle.

**Test:** Does this make the live session *easier* for the DM, or merely *more complete*? Easy wins. Completeness waits.

---



## 4. Optimize for live DMing

Build for real tables under time pressure—not for archive completeness or perfect data models.

- The DM should never think about saving.
- Prefer autosave, hooks, and ambient awareness over wizards and forms.
- Prefer paint-and-keep-state over remounts that wipe what they were typing.

**Test:** Could a tired DM use this mid-combat without a tutorial? If no, simplify.

---



## 5. Engines before UI

Logic lives in small engines (storage, notes, awareness, focus, registry). UI paints and attaches.

Do not bury business rules inside templates or one-off click handlers that other features cannot reuse.

**Test:** Can another feature call this capability without opening the Companion window? Engines yes; chrome-only hacks no.

---



## 6. AI assists; the DM decides

AI may propose text, links, summaries, or reminders. It never silently rewrites the world, owns truth, or bypasses Foundry permissions.

The DM always confirms or discards. Foundry documents remain authoritative.

**Test:** If the AI is wrong, can the DM ignore it with one action and zero world corruption?

---



## 7. Fast navigation

During play, everything important should be reachable in **two clicks or less** (or one shortcut later).

No nested diving for live tools. Workspaces stay flat. Chrome (context + focus) stays visible.

**Test:** Count clicks from “I need X” to “I’m editing/seeing X.” More than two during play → redesign.

---



## 8. Automation over manual bookkeeping

Prefer: listen to Foundry (hooks), derive context, auto-persist notes, detect entities.

Avoid: checklists the DM must tick to keep Companion “in sync,” manual re-entry of names/UUIDs Foundry already has, polling, save buttons for core capture.

**Test:** Does the DM have to do busywork the computer already knows? If yes, automate it.

---



## 9. Complement Foundry; don’t replace sheets

The Companion never reinvents Actor sheets, journals, or combat trackers.

Open or leverage Foundry when the sheet is the right tool. Companion stays the live assistant beside the table.

**Test:** Are we rebuilding a worse sheet, or easing the path around the real one?

---



## 10. Real use before perfection

Ship the smallest thing that reduces friction. Validate in a real session (`UX_NOTES.md`) before adding richness (markdown preview, graphs, AI).

**Test:** Have we watched a real session with this feature—or only imagined one?

---



## How to use this document

Before implementing a feature, answer:

1. What cognitive load does it remove during live play?
2. What Foundry data does it read vs. invent?
3. Does the DM ever enter the same fact twice?
4. Can it reuse an existing engine?
5. Is AI involved—and is the DM still the authority?

If any answer is weak, cut scope until the answers are clear.



## UI Evolution

The approved layout is considered stable.

New features should integrate into the existing interface rather than introducing new layouts.

The Companion should evolve through refinement instead of redesign.