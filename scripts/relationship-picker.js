import { CampaignMemoryService } from "./campaign-memory-service.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { StoryThreadService } from "./story-thread-service.js";

const RECENT_LIMIT = 8;

/**
 * Searchable relationship entity picker.
 * No artificial per-group cutoff — large campaigns stay fully reachable.
 */
export class RelationshipPicker {
  /** @type {{ kind: string, id: string, label: string }[]} */
  static #recent = [];

  /**
   * @param {HTMLElement} container
   * @param {{
   *   exclude?: { kind: string, id: string }[],
   *   onSelect?: (entry: { kind: string, id: string, label: string }) => void
   * }} [options]
   */
  static mount(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    EntityRegistry.rebuildAll();
    container.replaceChildren();
    container.className = "nd-relationship-picker";
    container.dataset.relationshipPicker = "";

    const search = document.createElement("input");
    search.type = "search";
    search.className = "nd-relationship-picker__search";
    search.dataset.relationshipPickerSearch = "";
    search.placeholder = "Search campaign knowledge…";
    search.setAttribute("aria-label", "Search relationships");
    search.autocomplete = "off";

    const results = document.createElement("div");
    results.className = "nd-relationship-picker__results";
    results.dataset.relationshipPickerResults = "";
    results.setAttribute("role", "listbox");

    container.append(search, results);

    const exclude = new Set(
      (options.exclude ?? []).map((entry) => `${entry.kind}:${entry.id}`)
    );

    const render = (query = "") => {
      RelationshipPicker.#paintResults(results, query, exclude, options.onSelect);
    };
    render("");

    search.addEventListener("input", () => render(search.value));
    search.addEventListener("keydown", (event) => {
      RelationshipPicker.#onKeydown(event, results, options.onSelect);
    });
  }

  /**
   * Full catalog grouped by type — no truncation.
   * @param {string} [query]
   * @returns {{ key: string, label: string, entries: { kind: string, id: string, label: string }[] }[]}
   */
  static catalog(query = "") {
    const needle = String(query ?? "").trim().toLocaleLowerCase();
    const matches = (name) =>
      !needle || String(name ?? "").toLocaleLowerCase().includes(needle);

    const groups = [
      {
        key: "actors",
        label: "Actor",
        kind: "actor",
        entries: EntityRegistry.all("actor")
          .filter((entity) => matches(entity.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((entity) => ({
            kind: "actor",
            id: entity.uuid,
            label: entity.name
          }))
      },
      {
        key: "factions",
        label: "Faction",
        kind: "faction",
        entries: FactionService.list()
          .filter((faction) => matches(faction.name?.trim() || "Untitled Faction"))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((faction) => ({
            kind: "faction",
            id: faction.id,
            label: faction.name?.trim() || "Untitled Faction"
          }))
      },
      {
        key: "storyThreads",
        label: "Story Thread",
        kind: "storyThread",
        entries: StoryThreadService.list()
          .filter((thread) => matches(thread.title?.trim() || "Untitled Story Thread"))
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((thread) => ({
            kind: "storyThread",
            id: thread.id,
            label: thread.title?.trim() || "Untitled Story Thread"
          }))
      },
      {
        key: "quests",
        label: "Quest",
        kind: "questEntry",
        entries: QuestEntryService.list()
          .filter((entry) => matches(entry.title?.trim() || "Untitled Quest"))
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((entry) => ({
            kind: "questEntry",
            id: entry.id,
            label: entry.title?.trim() || "Untitled Quest"
          }))
      },
      {
        key: "locations",
        label: "Location",
        kind: "location",
        entries: EntityRegistry.all("scene")
          .filter((entity) => matches(entity.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((entity) => ({
            kind: "location",
            id: entity.uuid,
            label: entity.name
          }))
      },
      {
        key: "items",
        label: "Item",
        kind: "item",
        entries: EntityRegistry.all("item")
          .filter((entity) => matches(entity.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((entity) => ({
            kind: "item",
            id: entity.uuid,
            label: entity.name
          }))
      },
      {
        key: "chronicle",
        label: "Chronicle",
        kind: "session",
        entries: CampaignMemoryService.list()
          .filter((session) => matches(CampaignMemoryService.label(session)))
          .map((session) => ({
            kind: "session",
            id: session.id,
            label: CampaignMemoryService.label(session)
          }))
      }
    ];

    return groups.filter((group) => group.entries.length > 0);
  }

  /** @param {{ kind: string, id: string, label: string }} entry */
  static remember(entry) {
    if (!entry?.kind || !entry?.id) return;
    RelationshipPicker.#recent = [
      entry,
      ...RelationshipPicker.#recent.filter(
        (item) => !(item.kind === entry.kind && item.id === entry.id)
      )
    ].slice(0, RECENT_LIMIT);
  }

  static recent() {
    return RelationshipPicker.#recent.slice();
  }

  static #paintResults(results, query, exclude, onSelect) {
    results.replaceChildren();
    const needle = String(query ?? "").trim();
    let activeSet = false;

    if (!needle && RelationshipPicker.#recent.length) {
      const recentGroup = RelationshipPicker.#groupElement("Recent", "recent");
      const list = recentGroup.querySelector(".nd-relationship-picker__list");
      for (const entry of RelationshipPicker.#recent) {
        if (exclude.has(`${entry.kind}:${entry.id}`)) continue;
        if (!list) continue;
        list.append(RelationshipPicker.#option(entry, onSelect, !activeSet));
        activeSet = true;
      }
      if (list?.childElementCount) results.append(recentGroup);
    }

    for (const group of RelationshipPicker.catalog(needle)) {
      const groupEl = RelationshipPicker.#groupElement(group.label, group.key);
      const list = groupEl.querySelector(".nd-relationship-picker__list");
      for (const entry of group.entries) {
        if (exclude.has(`${entry.kind}:${entry.id}`)) continue;
        list?.append(RelationshipPicker.#option(entry, onSelect, !activeSet));
        activeSet = true;
      }
      if (list?.childElementCount) results.append(groupEl);
    }

    if (!results.childElementCount) {
      const empty = document.createElement("p");
      empty.className = "nd-relationship-picker__empty";
      empty.textContent = needle ? "No matches." : "No campaign entities available.";
      results.append(empty);
    }
  }

  static #groupElement(label, key) {
    const group = document.createElement("div");
    group.className = "nd-relationship-picker__group";
    group.dataset.pickerGroup = key;
    const heading = document.createElement("div");
    heading.className = "nd-relationship-picker__group-label";
    heading.textContent = label;
    const list = document.createElement("div");
    list.className = "nd-relationship-picker__list";
    list.setAttribute("role", "group");
    group.append(heading, list);
    return group;
  }

  static #option(entry, onSelect, active = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nd-relationship-picker__option";
    button.dataset.pickerKind = entry.kind;
    button.dataset.pickerId = entry.id;
    button.dataset.pickerLabel = entry.label;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", active ? "true" : "false");
    if (active) button.classList.add("is-active");

    const badge = document.createElement("span");
    badge.className = "nd-rel-type";
    badge.dataset.relType = RelationshipPicker.typeKey(entry.kind);
    badge.textContent = RelationshipPicker.typeLabel(entry.kind);

    const name = document.createElement("span");
    name.className = "nd-relationship-picker__name";
    name.textContent = entry.label;

    button.append(badge, name);
    button.addEventListener("click", () => {
      RelationshipPicker.remember(entry);
      onSelect?.(entry);
    });
    return button;
  }

  static #onKeydown(event, results, onSelect) {
    const options = [...results.querySelectorAll(".nd-relationship-picker__option")];
    if (!options.length) return;
    const current = results.querySelector(".nd-relationship-picker__option.is-active");
    const index = current ? options.indexOf(current) : -1;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = options[Math.min(options.length - 1, index + 1)] ?? options[0];
      RelationshipPicker.#setActive(options, next);
      next.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = options[Math.max(0, index - 1)] ?? options[options.length - 1];
      RelationshipPicker.#setActive(options, prev);
      prev.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = results.querySelector(".nd-relationship-picker__option.is-active");
      if (!(active instanceof HTMLElement)) return;
      const entry = {
        kind: active.dataset.pickerKind ?? "",
        id: active.dataset.pickerId ?? "",
        label: active.dataset.pickerLabel ?? ""
      };
      if (!entry.kind || !entry.id) return;
      RelationshipPicker.remember(entry);
      onSelect?.(entry);
    }
  }

  static #setActive(options, next) {
    for (const option of options) {
      option.classList.toggle("is-active", option === next);
      option.setAttribute("aria-selected", option === next ? "true" : "false");
    }
  }

  /** @param {string} kind */
  static typeKey(kind) {
    switch (kind) {
      case "quest":
      case "beat":
      case "questEntry":
        return "quest";
      case "scene":
      case "location":
        return "location";
      case "session":
        return "chronicle";
      default:
        return kind;
    }
  }

  /** @param {string} kind */
  static typeLabel(kind) {
    switch (RelationshipPicker.typeKey(kind)) {
      case "storyThread":
        return "Story Thread";
      case "quest":
        return "Quest";
      case "actor":
        return "Actor";
      case "faction":
        return "Faction";
      case "location":
        return "Location";
      case "item":
        return "Item";
      case "chronicle":
        return "Chronicle";
      default:
        return "Entity";
    }
  }
}
