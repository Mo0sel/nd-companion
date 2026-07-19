# v0.1

- [x] Companion Window

- [x] Dashboard UI

- [ ] Live Notes

- [ ] Next Scene

- [ ] Open Threads

# v0.2

- [ ] Session Notes

- [ ] Scene Awareness

- [ ] Selected Actor Awareness

# v0.3

- [ ] NPC Brain

- [ ] Timeline

- [x] Campaign Memory

# v0.4

- [x] Session Log

- [ ] AI Updates

# v1.0

DM Operating System

---

# Future capabilities

## Markdown preview (post–Session Notes validation)

Gate: validate Session Notes through **at least one real campaign session** before any rich-text / markdown work.

Capability: optional markdown-backed reading layer for Live Notes surfaces (especially Session Notes).

Non-negotiable constraints for any future rich-text work:

- **Plain-text storage** — persisted content remains a plain string (markdown source is fine; never persist presentation HTML).
- **Live Notes as the persistence engine** — debounce, autosave, and `CompanionStorage` stay the write path; do not fork a second save stack.
- **Preview as a presentation layer only** — rendered output is transient (e.g. blur/idle preview); edit mode stays plain source; HTML must never round-trip into storage.

Preferred shape (from feasibility analysis): focus/edit source ↔ idle/blur preview, or a source/preview split — not WYSIWYG contenteditable that invents HTML.
