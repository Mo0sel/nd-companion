import { CampaignMemoryService } from "./campaign-memory-service.js";
import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";
import { SessionService } from "./session-service.js";
import { ThreadService } from "./thread-service.js";

const CATEGORY_LABELS = Object.freeze({
  MAIN: "Main Quests",
  SIDE: "Side Quests",
  COMPANION: "Companion Quests"
});

const ENTRY_FIELDS = Object.freeze([
  ["speechNotes", "Speech Notes"],
  ["objective", "Objective"],
  ["setup", "Setup"],
  ["twist", "Twist"],
  ["possibleOutcomes", "Possible Outcomes"],
  ["reward", "Reward"],
  ["notes", "Notes"]
]);

/**
 * Campaign authoring workspace.
 * Threads are presented as Quests; Quest Entries are campaign-owned sources.
 */
export class CampaignWorkspace {
  /** @type {"quest"|"memory"|"entity"} */
  static #view = "quest";

  /** @type {"quests"|"actors"|"locations"|"items"|"chronicle"} */
  static #section = "quests";

  /** @type {string|null} */
  static #questId = null;

  /** @type {string|null} */
  static #memoryId = null;

  /** @type {"actor"|"scene"|"item"|null} */
  static #entityKind = null;

  /** @type {string|null} */
  static #entityId = null;

  /** @type {string|null} */
  static #openEntryId = null;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /** @type {Set<HTMLElement>} */
  static #mentionEditors = new Set();

  /** @returns {string|null} */
  static getSelectedThreadId() {
    return CampaignWorkspace.#view === "quest" ? CampaignWorkspace.#questId : null;
  }

  /** @returns {string|null} */
  static getSelectedQuestId() {
    return CampaignWorkspace.getSelectedThreadId();
  }

  static selectThread(root, id) {
    return CampaignWorkspace.selectQuest(root, id);
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  static selectQuest(root, id) {
    if (!ThreadService.getById(id)) return false;
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.#section = "quests";
    CampaignWorkspace.#questId = id;
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.#openEntryId = null;
    CampaignWorkspace.paint(root);
    return true;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  static selectQuestEntry(root, id) {
    const entry = QuestEntryService.getById(id);
    if (!entry) return false;
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.#section = "quests";
    CampaignWorkspace.#questId = entry.questId;
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.#openEntryId = entry.id;
    CampaignWorkspace.paint(root);
    return true;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  static selectMemory(root, id) {
    if (!CampaignMemoryService.getById(id)) return false;
    CampaignWorkspace.#view = "memory";
    CampaignWorkspace.#section = "chronicle";
    CampaignWorkspace.#memoryId = id;
    CampaignWorkspace.#openEntryId = null;
    CampaignWorkspace.paint(root);
    return true;
  }

  /**
   * Search compatibility: current Session remains reachable without occupying
   * one of the visible Quest sections.
   */
  static selectSession(root, id) {
    return CampaignWorkspace.selectMemory(root, id);
  }

  /**
   * @param {HTMLElement} root
   */
  static paint(root) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-campaign-workspace]");
    if (!(panel instanceof HTMLElement)) return;

    const session = SessionService.getActive();
    const current = panel.querySelector("[data-campaign-current-session]");
    if (current) {
      current.textContent = session
        ? session.title?.trim()
          ? `Session ${session.sessionNumber} · ${session.title.trim()}`
          : `Session ${session.sessionNumber}`
        : "No active session";
    }

    const quests = ThreadService.list().sort((a, b) => a.title.localeCompare(b.title));
    CampaignWorkspace.#paintQuestLists(panel, quests);
    CampaignWorkspace.#paintMemoryList(panel);
    CampaignWorkspace.#paintCampaignNavigation(panel);
    CampaignWorkspace.#paintEntityList(panel);

    const quest = CampaignWorkspace.#questId
      ? ThreadService.getById(CampaignWorkspace.#questId)
      : null;
    if (CampaignWorkspace.#view === "quest" && CampaignWorkspace.#questId && !quest) {
      CampaignWorkspace.#questId = null;
    }

    const memory = CampaignWorkspace.#memoryId
      ? CampaignMemoryService.getById(CampaignWorkspace.#memoryId)
      : null;
    if (CampaignWorkspace.#view === "memory" && CampaignWorkspace.#memoryId && !memory) {
      CampaignWorkspace.#memoryId = null;
    }

    CampaignWorkspace.#paintQuest(panel, quest);
    CampaignWorkspace.#paintMemory(panel, memory);
    CampaignWorkspace.#paintEntity(panel);
    CampaignWorkspace.#applyView(panel, quest, memory);
    CampaignWorkspace.#attachRichEditors(panel);
  }

  /**
   * @param {HTMLElement} root
   * @param {{ onOpenBeat?: (index: number) => Promise<void>|void }} [options]
   */
  static attach(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-campaign-workspace]");
    if (!(panel instanceof HTMLElement)) return;

    CampaignWorkspace.#listeners.get(panel)?.abort();
    const controller = new AbortController();
    CampaignWorkspace.#listeners.set(panel, controller);

    panel.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const sectionButton = target.closest("[data-campaign-section]");
        if (sectionButton) {
          const section = sectionButton.getAttribute("data-campaign-section");
          CampaignWorkspace.#selectSection(root, section);
          return;
        }

        const newQuest = target.closest("[data-new-quest]");
        if (newQuest) {
          const category = newQuest.getAttribute("data-new-quest") || "SIDE";
          void CampaignWorkspace.#createQuest(root, category);
          return;
        }

        if (target.closest("[data-save-quest]")) {
          void CampaignWorkspace.#saveQuest(root);
          return;
        }

        if (target.closest("[data-add-quest-entry]")) {
          void CampaignWorkspace.#createEntry(root);
          return;
        }

        const questButton = target.closest("[data-quest-nav-id]");
        if (questButton) {
          const id = questButton.getAttribute("data-quest-nav-id");
          if (id) CampaignWorkspace.selectQuest(root, id);
          return;
        }

        const saveEntry = target.closest("[data-save-quest-entry]");
        if (saveEntry) {
          const id = saveEntry.getAttribute("data-save-quest-entry");
          if (id) void CampaignWorkspace.#saveEntry(root, id);
          return;
        }

        const beat = target.closest("[data-campaign-beat-index]");
        if (beat) {
          const index = Number(beat.getAttribute("data-campaign-beat-index"));
          if (Number.isInteger(index)) void Promise.resolve(options.onOpenBeat?.(index));
          return;
        }

        if (target.closest("[data-open-memory-import]")) {
          CampaignWorkspace.#setMemoryImportOpen(panel, true);
          return;
        }

        if (target.closest("[data-close-memory-import]")) {
          CampaignWorkspace.#setMemoryImportOpen(panel, false);
          return;
        }

        if (target.closest("[data-import-memory-session]")) {
          void CampaignWorkspace.#importMemory(root);
          return;
        }

        const memoryButton = target.closest("[data-memory-nav-id]");
        if (memoryButton) {
          const id = memoryButton.getAttribute("data-memory-nav-id");
          if (id) CampaignWorkspace.selectMemory(root, id);
          return;
        }

        if (target.closest("[data-save-memory-log]")) {
          void CampaignWorkspace.#saveMemoryLog(root);
          return;
        }

        const entityButton = target.closest("[data-campaign-entity-id]");
        if (entityButton) {
          const id = entityButton.getAttribute("data-campaign-entity-id");
          if (id) {
            CampaignWorkspace.#entityId = id;
            CampaignWorkspace.#view = "entity";
            CampaignWorkspace.paint(root);
          }
          return;
        }

        const memoryLink = target.closest("[data-open-memory-id]");
        if (memoryLink) {
          const id = memoryLink.getAttribute("data-open-memory-id");
          if (id) CampaignWorkspace.selectMemory(root, id);
        }
      },
      { signal: controller.signal }
    );

    CampaignWorkspace.#attachRichEditors(panel);
  }

  static #paintQuestLists(panel, quests) {
    for (const category of ["MAIN", "SIDE", "COMPANION"]) {
      const list = panel.querySelector(`[data-quest-list="${category}"]`);
      if (!list) continue;
      list.replaceChildren();
      const categoryQuests = quests.filter((quest) => quest.category === category);
      if (!categoryQuests.length) {
        const empty = document.createElement("div");
        empty.className = "nd-quest-sidebar__empty";
        empty.textContent = "No quests";
        list.append(empty);
        continue;
      }
      for (const quest of categoryQuests) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nd-quest-sidebar__quest";
        button.dataset.questNavId = quest.id;
        button.classList.toggle(
          "is-active",
          CampaignWorkspace.#view === "quest" && quest.id === CampaignWorkspace.#questId
        );
        const title = document.createElement("span");
        title.textContent = quest.title?.trim() || "Untitled Quest";
        const status = document.createElement("span");
        status.className = "nd-campaign-status";
        status.dataset.status = quest.status;
        status.textContent = quest.status;
        button.append(title, status);
        list.append(button);
      }
    }
  }

  static #selectSection(root, section) {
    const allowed = new Set(["quests", "actors", "locations", "items", "chronicle"]);
    if (!allowed.has(section)) return;
    CampaignWorkspace.#section = section;
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.#entityId = null;

    if (section === "quests") {
      CampaignWorkspace.#view = "quest";
    } else if (section === "chronicle") {
      CampaignWorkspace.#view = "memory";
    } else {
      CampaignWorkspace.#view = "entity";
      CampaignWorkspace.#entityKind =
        section === "actors" ? "actor" : section === "locations" ? "scene" : "item";
    }
    CampaignWorkspace.paint(root);
  }

  static #paintCampaignNavigation(panel) {
    panel.querySelectorAll("[data-campaign-section]").forEach((button) => {
      const active = button.getAttribute("data-campaign-section") === CampaignWorkspace.#section;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const quests = panel.querySelector("[data-campaign-nav-panel=\"quests\"]");
    const entities = panel.querySelector("[data-campaign-nav-panel=\"entities\"]");
    const chronicle = panel.querySelector("[data-campaign-nav-panel=\"chronicle\"]");
    if (quests instanceof HTMLElement) quests.hidden = CampaignWorkspace.#section !== "quests";
    if (entities instanceof HTMLElement) {
      entities.hidden = !["actors", "locations", "items"].includes(CampaignWorkspace.#section);
    }
    if (chronicle instanceof HTMLElement) {
      chronicle.hidden = CampaignWorkspace.#section !== "chronicle";
    }
  }

  static #paintEntityList(panel) {
    const list = panel.querySelector("[data-campaign-entity-list]");
    const heading = panel.querySelector("[data-campaign-entity-heading]");
    if (!list || !CampaignWorkspace.#entityKind) return;

    const labels = { actor: "Actors", scene: "Locations", item: "Items" };
    if (heading) heading.textContent = labels[CampaignWorkspace.#entityKind];
    list.replaceChildren();
    const entities = EntityRegistry.all(CampaignWorkspace.#entityKind)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!entities.length) {
      const empty = document.createElement("div");
      empty.className = "nd-quest-sidebar__empty";
      empty.textContent = "None";
      list.append(empty);
      return;
    }
    for (const entity of entities) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-quest-sidebar__quest";
      button.dataset.campaignEntityId = entity.uuid;
      button.classList.toggle("is-active", entity.uuid === CampaignWorkspace.#entityId);
      const name = document.createElement("span");
      name.textContent = entity.name;
      button.append(name);
      list.append(button);
    }
  }

  static #paintEntity(panel) {
    const view = panel.querySelector("[data-campaign-entity-view]");
    if (!(view instanceof HTMLElement)) return;
    const entity = CampaignWorkspace.#entityId
      ? EntityRegistry.findByUUID(CampaignWorkspace.#entityId)
      : null;
    if (!entity) {
      view.hidden = true;
      return;
    }
    const title = view.querySelector("[data-campaign-entity-title]");
    if (title) title.textContent = entity.name;
    CampaignWorkspace.#paintObjectHistory(
      view.querySelector("[data-campaign-entity-history]"),
      CampaignMemoryService.historyFor({ kind: entity.kind, id: entity.uuid }),
      {
        first: "[data-entity-history-first]",
        last: "[data-entity-history-last]",
        count: "[data-entity-history-count]",
        list: "[data-entity-history-list]"
      }
    );
  }

  static #paintQuest(panel, quest) {
    const editor = panel.querySelector("[data-quest-editor]");
    const empty = panel.querySelector("[data-quest-empty]");
    if (!(editor instanceof HTMLElement) || !(empty instanceof HTMLElement)) return;
    empty.hidden = Boolean(quest);
    editor.hidden = !quest;
    if (!quest) return;

    editor.dataset.questId = quest.id;
    editor.dataset.questCategory = quest.category ?? "SIDE";
    const eyebrow = editor.querySelector("[data-quest-eyebrow]");
    if (eyebrow) eyebrow.textContent = CATEGORY_LABELS[quest.category] ?? "Campaign Quest";
    const title = editor.querySelector("[data-quest-title]");
    const status = editor.querySelector("[data-quest-status]");
    const category = editor.querySelector("[data-quest-category]");
    const overview = editor.querySelector("[data-quest-overview]");
    if (title instanceof HTMLInputElement) title.value = quest.title ?? "";
    if (status instanceof HTMLSelectElement) status.value = quest.status ?? "OPEN";
    if (category instanceof HTMLSelectElement) category.value = quest.category ?? "SIDE";
    if (overview instanceof HTMLElement) overview.innerHTML = RichText.sanitize(quest.overview ?? "");

    const list = editor.querySelector("[data-quest-entry-list]");
    if (list) {
      list.replaceChildren();
      const entries = QuestEntryService.listForQuest(quest.id);
      if (!entries.length) {
        const noEntries = document.createElement("div");
        noEntries.className = "nd-quest-empty nd-quest-empty--entries";
        noEntries.textContent = "No playable entries yet.";
        list.append(noEntries);
      } else {
        for (const entry of entries) list.append(CampaignWorkspace.#entryElement(entry));
      }
    }

    CampaignWorkspace.#paintObjectHistory(
      editor.querySelector("[data-quest-history]"),
      CampaignMemoryService.historyFor({ kind: "quest", id: quest.id }),
      {
        first: "[data-quest-history-first]",
        last: "[data-quest-history-last]",
        count: "[data-quest-history-count]",
        list: "[data-quest-history-list]"
      }
    );
  }

  static #paintMemoryList(panel) {
    const list = panel.querySelector("[data-memory-list]");
    if (!list) return;
    list.replaceChildren();

    const records = CampaignMemoryService.list();
    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "nd-quest-sidebar__empty";
      empty.textContent = "No archived sessions";
      list.append(empty);
      return;
    }

    for (const record of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-quest-sidebar__quest nd-memory-nav";
      button.dataset.memoryNavId = record.id;
      button.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "memory" && record.id === CampaignWorkspace.#memoryId
      );
      const title = document.createElement("span");
      title.textContent = CampaignMemoryService.label(record);
      const source = document.createElement("small");
      source.textContent = record.source === "imported" ? "Imported" : "Live";
      button.append(title, source);
      list.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {import("./campaign-document.js").CampaignSession|null} memory
   */
  static #paintMemory(panel, memory) {
    const view = panel.querySelector("[data-memory-view]");
    if (!(view instanceof HTMLElement)) return;
    if (!memory) {
      view.hidden = true;
      return;
    }

    const title = view.querySelector("[data-memory-title]");
    const source = view.querySelector("[data-memory-source]");
    const log = view.querySelector("[data-memory-session-log]");
    if (title) {
      title.textContent = CampaignMemoryService.label(memory);
    }
    if (source) {
      source.textContent = memory.source === "imported" ? "Imported" : "Live";
      source.dataset.status = memory.source;
    }
    if (log instanceof HTMLTextAreaElement) log.value = memory.sessionLog ?? "";

    const labels = CampaignMemoryService.relatedLabels(memory);
    for (const kind of ["actor", "scene", "item", "quest", "beat"]) {
      const related = view.querySelector(`[data-memory-related="${kind}"]`);
      if (!related) continue;
      related.replaceChildren();
      const matches = labels.filter((item) => item.kind === kind);
      if (!matches.length) {
        const empty = document.createElement("span");
        empty.className = "nd-campaign-reference-empty";
        empty.textContent = "None detected";
        related.append(empty);
        continue;
      }
      for (const item of matches) {
        const chip = document.createElement("span");
        chip.className = "nd-campaign-reference";
        chip.dataset.kind = item.kind;
        chip.textContent = item.name;
        related.append(chip);
      }
    }
  }

  /**
   * @param {HTMLElement|null} section
   * @param {import("./campaign-memory-service.js").ObjectHistory} history
   * @param {{ first: string, last: string, count: string, list: string }} selectors
   */
  static #paintObjectHistory(section, history, selectors) {
    if (!(section instanceof HTMLElement)) return;
    const hasHistory = history.mentionCount > 0;
    section.hidden = false;

    const first = section.querySelector(selectors.first);
    const last = section.querySelector(selectors.last);
    const count = section.querySelector(selectors.count);
    const list = section.querySelector(selectors.list);
    if (first) first.textContent = history.firstAppearance?.label ?? "—";
    if (last) last.textContent = history.lastAppearance?.label ?? "—";
    if (count) {
      count.textContent = `${history.mentionCount} ${history.mentionCount === 1 ? "session" : "sessions"}`;
    }
    if (!list) return;

    list.replaceChildren();
    if (!hasHistory) {
      const empty = document.createElement("div");
      empty.className = "nd-campaign-reference-empty";
      empty.textContent = "No Chronicle appearances yet.";
      list.append(empty);
      return;
    }
    for (const appearance of history.appearsIn) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-object-history__item";
      button.dataset.openMemoryId = appearance.id;
      button.textContent = appearance.label;
      list.append(button);
    }
  }

  static #entryElement(entry) {
    const details = document.createElement("details");
    details.className = "nd-quest-entry";
    details.dataset.questEntryId = entry.id;
    details.open = entry.id === CampaignWorkspace.#openEntryId;

    const summary = document.createElement("summary");
    const status = document.createElement("span");
    status.className = "nd-campaign-status";
    status.dataset.status = entry.status;
    status.textContent = entry.status;
    const title = document.createElement("strong");
    title.textContent = entry.title?.trim() || "Untitled Entry";
    summary.append(status, title);

    const body = document.createElement("div");
    body.className = "nd-quest-entry__body";
    const headingFields = document.createElement("div");
    headingFields.className = "nd-campaign-thread-fields";
    headingFields.append(
      CampaignWorkspace.#inputField("Title", "title", entry.title, true),
      CampaignWorkspace.#statusField(entry.status)
    );
    body.append(headingFields);

    for (const [field, label] of ENTRY_FIELDS) {
      const wrapper = document.createElement("div");
      wrapper.className = "nd-campaign-field nd-quest-entry__field";
      const fieldLabel = document.createElement("span");
      fieldLabel.textContent = label;
      const rich = document.createElement("div");
      rich.className = "nd-richtext nd-richtext--editor";
      rich.dataset.entryField = field;
      rich.dataset.richtextEditor = "";
      rich.dataset.placeholder = `${label}...`;
      rich.contentEditable = "true";
      rich.innerHTML = RichText.sanitize(entry[field] ?? "");
      wrapper.append(fieldLabel, rich);
      body.append(wrapper);
    }

    const references = CampaignWorkspace.#referencesElement(entry);
    body.append(references);

    const history = CampaignMemoryService.historyFor({ kind: "beat", id: entry.id });
    const historySection = document.createElement("section");
    historySection.className = "nd-object-history nd-object-history--entry";
    const heading = document.createElement("h3");
    heading.className = "nd-hierarchy-group";
    heading.textContent = "History";
    const summary = document.createElement("p");
    summary.className = "nd-object-history__summary";
    summary.textContent = history.mentionCount > 0
      ? `First seen ${history.firstAppearance?.label}; ` +
        `last seen ${history.lastAppearance?.label}.`
      : "No Chronicle appearances yet.";
    const appearances = document.createElement("div");
    appearances.className = "nd-object-history__list";
    if (history.mentionCount > 0) {
      for (const appearance of history.appearsIn) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nd-object-history__item";
        button.dataset.openMemoryId = appearance.id;
        button.textContent = appearance.label;
        appearances.append(button);
      }
    }
    historySection.append(heading, summary, appearances);
    body.append(historySection);

    const actions = document.createElement("div");
    actions.className = "nd-quest-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "nd-campaign-save";
    save.dataset.saveQuestEntry = entry.id;
    save.textContent = "Save Entry";
    actions.append(save);
    body.append(actions);

    details.append(summary, body);
    return details;
  }

  static #inputField(label, field, value, wide = false) {
    const wrapper = document.createElement("label");
    wrapper.className = `nd-campaign-field${wide ? " nd-campaign-field--wide" : ""}`;
    const text = document.createElement("span");
    text.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.entryField = field;
    input.value = value ?? "";
    wrapper.append(text, input);
    return wrapper;
  }

  static #statusField(value) {
    const wrapper = document.createElement("label");
    wrapper.className = "nd-campaign-field";
    const text = document.createElement("span");
    text.textContent = "Status";
    const select = document.createElement("select");
    select.dataset.entryField = "status";
    for (const status of ["PLANNED", "ACTIVE", "COMPLETED"]) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status === value;
      select.append(option);
    }
    wrapper.append(text, select);
    return wrapper;
  }

  static #referencesElement(record) {
    const section = document.createElement("section");
    section.className = "nd-campaign-references";
    const heading = document.createElement("h3");
    heading.textContent = "References";
    section.append(heading);
    const groups = [
      ["Entries", record.relatedBeatIds ?? [], "beat"],
      ["Characters", record.relatedCharacterIds ?? [], "entity"],
      ["Locations", record.relatedLocationIds ?? [], "entity"],
      ["Items", record.relatedItemIds ?? [], "entity"]
    ];
    const beats = new Map([
      ...QuestEntryService.list().map((entry) => [entry.id, entry.title]),
      ...PlaybookService.getDocument().beats.map((beat) => [beat.id, beat.title])
    ]);

    for (const [label, ids, kind] of groups) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = label;
      const content = document.createElement("div");
      if (!ids.length) {
        const empty = document.createElement("span");
        empty.className = "nd-campaign-reference-empty";
        empty.textContent = "No references";
        content.append(empty);
      } else {
        for (const id of ids) {
          const chip = document.createElement("span");
          chip.className = "nd-campaign-reference";
          chip.textContent =
            kind === "beat" ? beats.get(id) ?? id : EntityRegistry.findByUUID(id)?.name ?? id;
          content.append(chip);
        }
      }
      details.append(summary, content);
      section.append(details);
    }
    return section;
  }

  static #applyView(panel, quest, memory) {
    const questLayout = panel.querySelector("[data-quest-editor]");
    const questEmpty = panel.querySelector("[data-quest-empty]");
    const memoryView = panel.querySelector("[data-memory-view]");
    const entityView = panel.querySelector("[data-campaign-entity-view]");
    if (memoryView instanceof HTMLElement) {
      memoryView.hidden = CampaignWorkspace.#view !== "memory" || !memory;
    }
    if (entityView instanceof HTMLElement) {
      entityView.hidden = CampaignWorkspace.#view !== "entity" || !CampaignWorkspace.#entityId;
    }
    if (questLayout instanceof HTMLElement) {
      questLayout.hidden = CampaignWorkspace.#view !== "quest" || !quest;
    }
    if (questEmpty instanceof HTMLElement) {
      questEmpty.hidden = true;
      if (CampaignWorkspace.#view === "memory" && !memory) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select an archived session or import a Session Log.";
      } else if (CampaignWorkspace.#view === "entity" && !CampaignWorkspace.#entityId) {
        questEmpty.hidden = false;
        questEmpty.textContent = `Select an object to view its History.`;
      } else if (CampaignWorkspace.#view === "quest" && !quest) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a Quest or create one to begin writing your campaign.";
      }
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {boolean} open
   */
  static #setMemoryImportOpen(panel, open) {
    const overlay = panel.querySelector("[data-memory-import]");
    if (!(overlay instanceof HTMLElement)) return;
    overlay.hidden = !open;
    if (open) {
      requestAnimationFrame(() => {
        panel.querySelector("[data-memory-import-number]")?.focus();
      });
    }
  }

  /**
   * @param {HTMLElement} root
   */
  static async #importMemory(root) {
    const panel = root.querySelector("[data-campaign-workspace]");
    if (!(panel instanceof HTMLElement)) return;

    const numberInput = panel.querySelector("[data-memory-import-number]");
    const titleInput = panel.querySelector("[data-memory-import-title]");
    const logInput = panel.querySelector("[data-memory-import-log]");
    const sessionNumber =
      numberInput instanceof HTMLInputElement ? Number(numberInput.value) : NaN;
    const title = titleInput instanceof HTMLInputElement ? titleInput.value : "";
    const sessionLog = logInput instanceof HTMLTextAreaElement ? logInput.value : "";

    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) {
      ui.notifications?.warn("Enter a valid session number.");
      return;
    }
    if (!sessionLog.trim()) {
      ui.notifications?.warn("Enter a Session Log to import.");
      return;
    }

    const result = await CampaignMemoryService.importSession({
      sessionNumber,
      title,
      sessionLog
    });
    if (!result.ok && result.reason === "duplicate") {
      ui.notifications?.warn(`Session ${Math.trunc(sessionNumber)} already exists.`);
      return;
    }
    if (!result.ok) {
      ui.notifications?.error("Could not import session into Campaign Memory.");
      return;
    }
    const record = result.session;

    if (numberInput instanceof HTMLInputElement) numberInput.value = "";
    if (titleInput instanceof HTMLInputElement) titleInput.value = "";
    if (logInput instanceof HTMLTextAreaElement) logInput.value = "";
    CampaignWorkspace.#setMemoryImportOpen(panel, false);
    CampaignWorkspace.#view = "memory";
    CampaignWorkspace.#memoryId = record.id;
    CampaignWorkspace.paint(root);
    ui.notifications?.info(`Imported Session ${record.sessionNumber} into Chronicle.`);
  }

  static async #saveMemoryLog(root) {
    if (!CampaignWorkspace.#memoryId) return;
    const input = root.querySelector("[data-memory-session-log]");
    if (!(input instanceof HTMLTextAreaElement)) return;
    const updated = await CampaignMemoryService.updateSessionLog(
      CampaignWorkspace.#memoryId,
      input.value
    );
    if (!updated) {
      ui.notifications?.error("Could not update the Session Log.");
      return;
    }
    CampaignWorkspace.paint(root);
    ui.notifications?.info("Session Log saved and relationships refreshed.");
  }

  static #attachRichEditors(panel) {
    for (const editor of CampaignWorkspace.#mentionEditors) EntityMentions.detach(editor);
    CampaignWorkspace.#mentionEditors.clear();
    RichTextToolbar.attach(panel);
    panel.querySelectorAll("[data-richtext-editor]").forEach((editor) => {
      if (!(editor instanceof HTMLElement) || editor.closest("[aria-hidden=\"true\"]")) return;
      EntityMentions.attach(editor);
      CampaignWorkspace.#mentionEditors.add(editor);
    });
  }

  static async #createQuest(root, category) {
    const quest = await ThreadService.create({
      title: "Untitled Quest",
      status: "OPEN",
      category,
      overview: ""
    });
    CampaignWorkspace.#questId = quest.id;
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => root.querySelector("[data-quest-title]")?.focus());
  }

  static async #saveQuest(root) {
    const editor = root.querySelector("[data-quest-editor]");
    if (!(editor instanceof HTMLElement)) return;
    const id = editor.dataset.questId;
    if (!id) return;
    const title = editor.querySelector("[data-quest-title]");
    const status = editor.querySelector("[data-quest-status]");
    const category = editor.querySelector("[data-quest-category]");
    const overview = editor.querySelector("[data-quest-overview]");
    const safeOverview = overview instanceof HTMLElement ? RichText.sanitize(overview.innerHTML) : "";
    const refs = CampaignWorkspace.#referencePatch(EntityMentions.extract(safeOverview));
    await ThreadService.update(id, {
      title: title instanceof HTMLInputElement ? title.value.trim() : "",
      status: status instanceof HTMLSelectElement ? status.value : "OPEN",
      category: category instanceof HTMLSelectElement ? category.value : "SIDE",
      overview: safeOverview,
      description: RichText.plainText(safeOverview),
      ...refs
    });
    CampaignWorkspace.paint(root);
  }

  static async #createEntry(root) {
    if (!CampaignWorkspace.#questId) return;
    const entry = await QuestEntryService.create(CampaignWorkspace.#questId);
    if (!entry) return;
    CampaignWorkspace.#openEntryId = entry.id;
    CampaignWorkspace.paint(root);
  }

  static async #saveEntry(root, id) {
    const details = root.querySelector(`[data-quest-entry-id="${id}"]`);
    if (!(details instanceof HTMLElement)) return;
    const patch = {};
    const richHtml = [];
    details.querySelectorAll("[data-entry-field]").forEach((field) => {
      const key = field.getAttribute("data-entry-field");
      if (!key) return;
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        patch[key] = field.value.trim();
      } else if (field instanceof HTMLElement) {
        const safe = RichText.sanitize(field.innerHTML);
        patch[key] = safe;
        richHtml.push(safe);
      }
    });
    Object.assign(patch, CampaignWorkspace.#referencePatch(
      EntityMentions.extract(richHtml.join(""))
    ));
    await QuestEntryService.update(id, patch);
    CampaignWorkspace.#openEntryId = id;
    CampaignWorkspace.paint(root);
  }

  static #referencePatch(mentions) {
    const ids = (kind, preferUuid) =>
      mentions
        .filter((mention) => mention.kind === kind)
        .map((mention) => (preferUuid ? mention.uuid : mention.id) || mention.id)
        .filter(Boolean);
    return {
      relatedBeatIds: ids("beat", false),
      relatedCharacterIds: ids("actor", true),
      relatedLocationIds: ids("scene", true),
      relatedItemIds: ids("item", true)
    };
  }
}
