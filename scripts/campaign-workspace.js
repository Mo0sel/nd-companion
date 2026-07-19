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
  /** @type {"quest"|"session"|"memory"} */
  static #view = "quest";

  /** @type {string|null} */
  static #questId = null;

  /** @type {string|null} */
  static #memoryId = null;

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
    if (!SessionService.getById(id)) return false;
    CampaignWorkspace.#view = "session";
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.paint(root);
    return true;
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
    if (current) current.textContent = session?.title?.trim() || "No active session";

    const quests = ThreadService.list().sort((a, b) => a.title.localeCompare(b.title));
    CampaignWorkspace.#paintQuestLists(panel, quests);
    CampaignWorkspace.#paintMemoryList(panel);

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
    CampaignWorkspace.#paintSession(panel, session);
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

        if (target.closest("[data-delete-memory]")) {
          void CampaignWorkspace.#deleteMemory(root);
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
      empty.textContent = "No memory yet";
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
      title.textContent = record.title?.trim()
        ? `Session ${record.sessionNumber} · ${record.title.trim()}`
        : `Session ${record.sessionNumber}`;
      button.append(title);
      list.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {import("./campaign-document.js").CampaignMemoryRecord|null} memory
   */
  static #paintMemory(panel, memory) {
    const view = panel.querySelector("[data-memory-view]");
    if (!(view instanceof HTMLElement)) return;
    if (!memory) {
      view.hidden = true;
      return;
    }

    const title = view.querySelector("[data-memory-title]");
    const summary = view.querySelector("[data-memory-summary]");
    const related = view.querySelector("[data-memory-related]");
    if (title) {
      title.textContent = memory.title?.trim()
        ? `Session ${memory.sessionNumber} · ${memory.title.trim()}`
        : `Session ${memory.sessionNumber}`;
    }
    if (summary) summary.textContent = memory.summary || "No summary.";
    if (related) {
      related.replaceChildren();
      const labels = CampaignMemoryService.relatedLabels(memory);
      if (!labels.length) {
        const empty = document.createElement("span");
        empty.className = "nd-campaign-reference-empty";
        empty.textContent = "No related objects found in this summary.";
        related.append(empty);
      } else {
        for (const item of labels) {
          const chip = document.createElement("span");
          chip.className = "nd-campaign-reference";
          chip.dataset.kind = item.kind;
          chip.textContent = item.name;
          related.append(chip);
        }
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
    section.hidden = !hasHistory;
    if (!hasHistory) return;

    const first = section.querySelector(selectors.first);
    const last = section.querySelector(selectors.last);
    const count = section.querySelector(selectors.count);
    const list = section.querySelector(selectors.list);
    if (first) first.textContent = history.firstAppearance?.label ?? "—";
    if (last) last.textContent = history.lastAppearance?.label ?? "—";
    if (count) count.textContent = String(history.mentionCount);
    if (!list) return;

    list.replaceChildren();
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

  static #paintSession(panel, session) {
    const view = panel.querySelector("[data-quest-session-view]");
    if (!(view instanceof HTMLElement)) return;
    const setText = (key, value, fallback = "—") => {
      const element = view.querySelector(`[data-campaign-session="${key}"]`);
      if (element) element.textContent = String(value || fallback);
    };
    setText("title", session?.title, "Session 1");
    setText("status", session?.status);
    CampaignWorkspace.#paintRichText(
      view.querySelector("[data-campaign-session=\"summary\"]"),
      session?.summary,
      "No session summary yet."
    );
    CampaignWorkspace.#paintRichText(
      view.querySelector("[data-campaign-session=\"notes\"]"),
      session?.notes,
      "No session notes yet."
    );

    const list = view.querySelector("[data-campaign-session-beats]");
    if (!list) return;
    list.replaceChildren();
    const playbook = PlaybookService.getDocument();
    const byId = new Map(playbook.beats.map((beat, index) => [beat.id, { beat, index }]));
    for (const id of session?.beatIds ?? []) {
      const item = byId.get(id);
      if (!item) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-campaign-beat";
      button.dataset.campaignBeatIndex = String(item.index);
      button.textContent = item.beat.title?.trim() || "Untitled Entry";
      list.append(button);
    }
  }

  static #applyView(panel, quest, memory) {
    const questLayout = panel.querySelector("[data-quest-editor]");
    const questEmpty = panel.querySelector("[data-quest-empty]");
    const session = panel.querySelector("[data-quest-session-view]");
    const memoryView = panel.querySelector("[data-memory-view]");
    if (session instanceof HTMLElement) session.hidden = CampaignWorkspace.#view !== "session";
    if (memoryView instanceof HTMLElement) {
      memoryView.hidden = CampaignWorkspace.#view !== "memory" || !memory;
    }
    if (questLayout instanceof HTMLElement) {
      questLayout.hidden = CampaignWorkspace.#view !== "quest" || !quest;
    }
    if (questEmpty instanceof HTMLElement) {
      questEmpty.hidden =
        (CampaignWorkspace.#view !== "quest" || Boolean(quest)) &&
        CampaignWorkspace.#view !== "memory";
      if (CampaignWorkspace.#view === "memory" && !memory) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a memory record or import a session summary.";
      } else if (CampaignWorkspace.#view === "quest" && !quest) {
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
    const summaryInput = panel.querySelector("[data-memory-import-summary]");
    const sessionNumber =
      numberInput instanceof HTMLInputElement ? Number(numberInput.value) : NaN;
    const title = titleInput instanceof HTMLInputElement ? titleInput.value : "";
    const summary = summaryInput instanceof HTMLTextAreaElement ? summaryInput.value : "";

    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) {
      ui.notifications?.warn("Enter a valid session number.");
      return;
    }
    if (!summary.trim()) {
      ui.notifications?.warn("Enter a session summary to import.");
      return;
    }

    const record = await CampaignMemoryService.importSession({
      sessionNumber,
      title,
      summary
    });
    if (!record) {
      ui.notifications?.error("Could not import session into Campaign Memory.");
      return;
    }

    if (numberInput instanceof HTMLInputElement) numberInput.value = "";
    if (titleInput instanceof HTMLInputElement) titleInput.value = "";
    if (summaryInput instanceof HTMLTextAreaElement) summaryInput.value = "";
    CampaignWorkspace.#setMemoryImportOpen(panel, false);
    CampaignWorkspace.#view = "memory";
    CampaignWorkspace.#memoryId = record.id;
    CampaignWorkspace.paint(root);
    ui.notifications?.info(`Imported Session ${record.sessionNumber} into Campaign Memory.`);
  }

  /**
   * @param {HTMLElement} root
   */
  static async #deleteMemory(root) {
    if (!CampaignWorkspace.#memoryId) return;
    const record = CampaignMemoryService.getById(CampaignWorkspace.#memoryId);
    if (!record) return;

    const label = record.title?.trim()
      ? `Session ${record.sessionNumber} · ${record.title.trim()}`
      : `Session ${record.sessionNumber}`;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Memory Record" },
      content: `<p>Delete memory for <strong>${foundry.utils.escapeHTML(label)}</strong>?</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;

    await CampaignMemoryService.delete(record.id);
    CampaignWorkspace.#memoryId = null;
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.paint(root);
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

  static #paintRichText(element, html, fallback) {
    if (!(element instanceof HTMLElement)) return;
    const safe = RichText.sanitize(html ?? "");
    if (RichText.hasContent(safe)) {
      element.innerHTML = safe;
      element.classList.remove("nd-campaign-empty");
    } else {
      element.textContent = fallback;
      element.classList.add("nd-campaign-empty");
    }
  }
}
