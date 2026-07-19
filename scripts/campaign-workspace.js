import { CampaignMemoryService } from "./campaign-memory-service.js";
import { ContextEngine } from "./context-engine.js";
import { ContextPanel } from "./context-panel.js";
import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { LiveNotes } from "./live-notes.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
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
 * Quests are player objectives; Story Threads own playable Scenes.
 */
export class CampaignWorkspace {
  /** @type {"quest"|"storyThread"|"faction"|"memory"|"entity"} */
  static #view = "quest";

  /** @type {"quests"|"storyThreads"|"factions"|"actors"|"locations"|"items"|"chronicle"} */
  static #section = "quests";

  /** @type {string|null} */
  static #questId = null;

  /** @type {string|null} */
  static #memoryId = null;

  /** @type {string|null} */
  static #storyThreadId = null;

  /** @type {string|null} */
  static #factionId = null;

  /** @type {"actor"|"scene"|"item"|null} */
  static #entityKind = null;

  /** @type {string|null} */
  static #entityId = null;

  /** @type {string|null} */
  static #openEntryId = null;

  /** @type {Map<string, string>} */
  static #lastSelections = new Map();

  /** @type {Map<string, number>} */
  static #scrollPositions = new Map();

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /** @type {Set<HTMLElement>} */
  static #mentionEditors = new Set();

  /** @type {ReturnType<typeof setTimeout>|null} */
  static #autosaveTimer = null;

  /** @type {ReturnType<typeof setTimeout>|null} */
  static #autosaveStatusTimer = null;

  /** @type {ReturnType<typeof setTimeout>|null} */
  static #autosaveRetryTimer = null;

  /** @type {number} */
  static #autosaveRevision = 0;

  /** @type {boolean} */
  static #autosaveDirty = false;

  /** @returns {string|null} */
  static getSelectedThreadId() {
    return CampaignWorkspace.#view === "quest" ? CampaignWorkspace.#questId : null;
  }

  /** @returns {string|null} */
  static getSelectedQuestId() {
    return CampaignWorkspace.getSelectedThreadId();
  }

  /**
   * Capture all visible Campaign edits before navigation or close.
   * @param {HTMLElement} root
   */
  static async flush(root) {
    clearTimeout(CampaignWorkspace.#autosaveTimer);
    CampaignWorkspace.#autosaveTimer = null;
    const panel = root?.querySelector?.("[data-campaign-workspace]");
    if (!(panel instanceof HTMLElement)) return;
    const revision = CampaignWorkspace.#autosaveRevision;
    try {
      await Promise.all([
        CampaignWorkspace.#autosaveDirty
          ? CampaignWorkspace.#saveActive(root)
          : Promise.resolve(),
        LiveNotes.flushAll(panel)
      ]);
      if (revision === CampaignWorkspace.#autosaveRevision) {
        CampaignWorkspace.#autosaveDirty = false;
      }
    } catch (error) {
      CampaignWorkspace.#setAutosaveStatus(root, "Unsaved changes");
      clearTimeout(CampaignWorkspace.#autosaveRetryTimer);
      CampaignWorkspace.#autosaveRetryTimer = setTimeout(() => {
        CampaignWorkspace.#autosaveRetryTimer = null;
        void CampaignWorkspace.#runAutosave(root);
      }, 1500);
      throw error;
    }
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
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.#section = "quests";
    CampaignWorkspace.#questId = id;
    CampaignWorkspace.#lastSelections.set("quests", id);
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
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    if (!StoryThreadService.getById(entry.storyThreadId)) return false;
    CampaignWorkspace.#view = "storyThread";
    CampaignWorkspace.#section = "storyThreads";
    CampaignWorkspace.#questId = null;
    CampaignWorkspace.#storyThreadId = entry.storyThreadId;
    CampaignWorkspace.#lastSelections.set("storyThreads", entry.storyThreadId);
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
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "memory";
    CampaignWorkspace.#section = "chronicle";
    CampaignWorkspace.#memoryId = id;
    CampaignWorkspace.#lastSelections.set("chronicle", id);
    CampaignWorkspace.#openEntryId = null;
    CampaignWorkspace.paint(root);
    return true;
  }

  static selectStoryThread(root, id) {
    if (!StoryThreadService.getById(id)) return false;
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "storyThread";
    CampaignWorkspace.#section = "storyThreads";
    CampaignWorkspace.#storyThreadId = id;
    CampaignWorkspace.#lastSelections.set("storyThreads", id);
    CampaignWorkspace.paint(root);
    return true;
  }

  static selectFaction(root, id) {
    if (!FactionService.getById(id)) return false;
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "faction";
    CampaignWorkspace.#section = "factions";
    CampaignWorkspace.#factionId = id;
    CampaignWorkspace.#lastSelections.set("factions", id);
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
   * Select an Actor, Location, or Item in the generic Campaign entity view.
   * @param {HTMLElement} root
   * @param {"actor"|"scene"|"item"} kind
   * @param {string} id Registry UUID
   */
  static selectEntity(root, kind, id) {
    const entity = EntityRegistry.findByUUID(id);
    if (!entity || entity.kind !== kind || !["actor", "scene", "item"].includes(kind)) {
      return false;
    }
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    const section =
      kind === "actor" ? "actors" : kind === "scene" ? "locations" : "items";
    CampaignWorkspace.#section = section;
    CampaignWorkspace.#entityKind = kind;
    CampaignWorkspace.#entityId = id;
    CampaignWorkspace.#lastSelections.set(section, id);
    CampaignWorkspace.#view = "entity";
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
    if (current) {
      current.textContent = session
        ? session.title?.trim()
          ? `Session ${session.sessionNumber} · ${session.title.trim()}`
          : `Session ${session.sessionNumber}`
        : "No active session";
    }

    const quests = ThreadService.list().sort((a, b) => a.title.localeCompare(b.title));
    CampaignWorkspace.#paintQuestLists(panel, quests);
    CampaignWorkspace.#paintStoryThreadList(panel);
    CampaignWorkspace.#paintFactionList(panel);
    CampaignWorkspace.#paintMemoryList(panel);
    CampaignWorkspace.#paintCampaignNavigation(panel);
    CampaignWorkspace.#paintEntityList(panel);

    const quest = CampaignWorkspace.#questId
      ? ThreadService.getById(CampaignWorkspace.#questId)
      : null;
    if (CampaignWorkspace.#view === "quest" && CampaignWorkspace.#questId && !quest) {
      CampaignWorkspace.#lastSelections.delete("quests");
      CampaignWorkspace.#questId = null;
    }

    const memory = CampaignWorkspace.#memoryId
      ? CampaignMemoryService.getById(CampaignWorkspace.#memoryId)
      : null;
    if (CampaignWorkspace.#view === "memory" && CampaignWorkspace.#memoryId && !memory) {
      CampaignWorkspace.#lastSelections.delete("chronicle");
      CampaignWorkspace.#memoryId = null;
    }
    const storyThread = CampaignWorkspace.#storyThreadId
      ? StoryThreadService.getById(CampaignWorkspace.#storyThreadId)
      : null;
    if (
      CampaignWorkspace.#view === "storyThread" &&
      CampaignWorkspace.#storyThreadId &&
      !storyThread
    ) {
      CampaignWorkspace.#lastSelections.delete("storyThreads");
      CampaignWorkspace.#storyThreadId = null;
    }
    const faction = CampaignWorkspace.#factionId
      ? FactionService.getById(CampaignWorkspace.#factionId)
      : null;
    if (CampaignWorkspace.#view === "faction" && CampaignWorkspace.#factionId && !faction) {
      CampaignWorkspace.#lastSelections.delete("factions");
      CampaignWorkspace.#factionId = null;
    }

    CampaignWorkspace.#paintQuest(
      panel,
      CampaignWorkspace.#view === "quest" ? quest : null
    );
    CampaignWorkspace.#paintMemory(
      panel,
      CampaignWorkspace.#view === "memory" ? memory : null
    );
    CampaignWorkspace.#paintStoryThread(
      panel,
      CampaignWorkspace.#view === "storyThread" ? storyThread : null
    );
    CampaignWorkspace.#paintFaction(
      panel,
      CampaignWorkspace.#view === "faction" ? faction : null
    );
    CampaignWorkspace.#paintEntity(panel);
    CampaignWorkspace.#applyView(panel, quest, memory, storyThread, faction);
    CampaignWorkspace.#attachRichEditors(panel);
    CampaignWorkspace.#restoreScroll(panel);
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
    const sidebarScroll = panel.querySelector(".nd-quest-sidebar__scroll");
    if (sidebarScroll instanceof HTMLElement) {
      sidebarScroll.addEventListener(
        "scroll",
        () => {
          CampaignWorkspace.#scrollPositions.set(
            CampaignWorkspace.#section,
            sidebarScroll.scrollTop
          );
        },
        { signal: controller.signal, passive: true }
      );
    }

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

        if (target.closest("[data-new-story-thread]")) {
          void CampaignWorkspace.#createStoryThread(root);
          return;
        }

        const storyThreadButton = target.closest("[data-story-thread-nav-id]");
        if (storyThreadButton) {
          const id = storyThreadButton.getAttribute("data-story-thread-nav-id");
          if (id) CampaignWorkspace.selectStoryThread(root, id);
          return;
        }

        if (target.closest("[data-new-faction]")) {
          void CampaignWorkspace.#createFaction(root);
          return;
        }

        const factionButton = target.closest("[data-faction-nav-id]");
        if (factionButton) {
          const id = factionButton.getAttribute("data-faction-nav-id");
          if (id) CampaignWorkspace.selectFaction(root, id);
          return;
        }

        if (target.closest("[data-add-faction-objective]")) {
          const list = panel.querySelector("[data-faction-objectives]");
          if (list instanceof HTMLElement) {
            list.append(CampaignWorkspace.#factionObjectiveElement(""));
            CampaignWorkspace.#attachRichEditors(panel);
            list.lastElementChild?.querySelector("[data-faction-objective]")?.focus();
            CampaignWorkspace.#scheduleAutosave(root);
          }
          return;
        }

        const removeObjective = target.closest("[data-remove-faction-objective]");
        if (removeObjective) {
          removeObjective.closest("[data-faction-objective-row]")?.remove();
          CampaignWorkspace.#scheduleAutosave(root);
          return;
        }

        if (target.closest("[data-add-faction-leader]")) {
          const picker = panel.querySelector("[data-faction-leader-picker]");
          const list = panel.querySelector("[data-faction-leadership]");
          if (picker instanceof HTMLSelectElement && list instanceof HTMLElement && picker.value) {
            const exists = [...list.querySelectorAll("[data-faction-leader-id]")]
              .some((row) => row.getAttribute("data-faction-leader-id") === picker.value);
            if (!exists) {
              list.append(CampaignWorkspace.#factionLeaderElement(picker.value));
              CampaignWorkspace.#scheduleAutosave(root);
            }
          }
          return;
        }

        const removeLeader = target.closest("[data-remove-faction-leader]");
        if (removeLeader) {
          removeLeader.closest("[data-faction-leader-id]")?.remove();
          CampaignWorkspace.#scheduleAutosave(root);
          return;
        }

        const newQuest = target.closest("[data-new-quest]");
        if (newQuest) {
          const category = newQuest.getAttribute("data-new-quest") || "SIDE";
          void CampaignWorkspace.#createQuest(root, category);
          return;
        }

        if (target.closest("[data-add-story-entry]")) {
          void CampaignWorkspace.#createEntry(root);
          return;
        }

        if (target.closest("[data-load-story-entries]")) {
          void CampaignWorkspace.#loadStoryEntries(root);
          return;
        }

        const loadStoryEntry = target.closest("[data-load-story-entry]");
        if (loadStoryEntry) {
          const id = loadStoryEntry.getAttribute("data-load-story-entry");
          if (id) void CampaignWorkspace.#loadStoryEntry(root, id);
          return;
        }

        const questButton = target.closest("[data-quest-nav-id]");
        if (questButton) {
          const id = questButton.getAttribute("data-quest-nav-id");
          if (id) CampaignWorkspace.selectQuest(root, id);
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
          if (id && CampaignWorkspace.#entityKind) {
            CampaignWorkspace.selectEntity(root, CampaignWorkspace.#entityKind, id);
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

    panel.addEventListener(
      "input",
      (event) => {
        if (CampaignWorkspace.#autosaveField(event.target)) {
          CampaignWorkspace.#scheduleAutosave(root);
        }
      },
      { signal: controller.signal }
    );
    panel.addEventListener(
      "change",
      (event) => {
        if (CampaignWorkspace.#autosaveField(event.target)) {
          CampaignWorkspace.#scheduleAutosave(root);
          void CampaignWorkspace.#runAutosave(root);
        }
      },
      { signal: controller.signal }
    );
    panel.addEventListener(
      "focusout",
      (event) => {
        if (CampaignWorkspace.#autosaveField(event.target)) {
          void CampaignWorkspace.#runAutosave(root);
        }
      },
      { signal: controller.signal }
    );

    CampaignWorkspace.#attachRichEditors(panel);
  }

  static #autosaveField(target) {
    if (!(target instanceof Element)) return null;
    return target.closest([
      "[data-quest-title]",
      "[data-quest-status]",
      "[data-quest-category]",
      "[data-quest-overview]",
      "[data-entry-field]",
      "[data-story-thread-title]",
      "[data-story-thread-status]",
      "[data-story-thread-description]",
      "[data-story-thread-current-state]",
      "[data-faction-name]",
      "[data-faction-icon]",
      "[data-faction-description]",
      "[data-faction-current-status]",
      "[data-faction-resources]",
      "[data-faction-reputation]",
      "[data-faction-objective]"
    ].join(","));
  }

  static #scheduleAutosave(root) {
    CampaignWorkspace.#autosaveRevision += 1;
    CampaignWorkspace.#autosaveDirty = true;
    clearTimeout(CampaignWorkspace.#autosaveTimer);
    clearTimeout(CampaignWorkspace.#autosaveRetryTimer);
    CampaignWorkspace.#autosaveTimer = setTimeout(() => {
      CampaignWorkspace.#autosaveTimer = null;
      void CampaignWorkspace.#runAutosave(root);
    }, 650);
  }

  static async #runAutosave(root) {
    clearTimeout(CampaignWorkspace.#autosaveTimer);
    CampaignWorkspace.#autosaveTimer = null;
    if (!CampaignWorkspace.#autosaveDirty) return;
    const revision = CampaignWorkspace.#autosaveRevision;
    CampaignWorkspace.#setAutosaveStatus(root, "Saving...");
    try {
      await CampaignWorkspace.#saveActive(root);
      if (revision !== CampaignWorkspace.#autosaveRevision) return;
      CampaignWorkspace.#autosaveDirty = false;
      CampaignWorkspace.#setAutosaveStatus(root, "Saved");
      clearTimeout(CampaignWorkspace.#autosaveStatusTimer);
      CampaignWorkspace.#autosaveStatusTimer = setTimeout(() => {
        CampaignWorkspace.#setAutosaveStatus(root, "");
      }, 1200);
    } catch (error) {
      console.error("N&D Companion: campaign autosave failed", error);
      CampaignWorkspace.#setAutosaveStatus(root, "Unsaved changes");
      clearTimeout(CampaignWorkspace.#autosaveRetryTimer);
      CampaignWorkspace.#autosaveRetryTimer = setTimeout(() => {
        CampaignWorkspace.#autosaveRetryTimer = null;
        void CampaignWorkspace.#runAutosave(root);
      }, 1500);
    }
  }

  static async #saveActive(root) {
    if (CampaignWorkspace.#view === "quest" && CampaignWorkspace.#questId) {
      await CampaignWorkspace.#saveQuest(root, false);
      return;
    }
    if (CampaignWorkspace.#view === "storyThread" && CampaignWorkspace.#storyThreadId) {
      const view = root.querySelector("[data-story-thread-view]");
      const entryIds = view
        ? [...view.querySelectorAll("[data-quest-entry-id]")]
            .map((entry) => entry.getAttribute("data-quest-entry-id"))
            .filter(Boolean)
        : [];
      await Promise.all([
        CampaignWorkspace.#saveStoryThread(root, false),
        ...entryIds.map((id) => CampaignWorkspace.#saveEntry(root, id, false))
      ]);
      return;
    }
    if (CampaignWorkspace.#view === "faction" && CampaignWorkspace.#factionId) {
      await CampaignWorkspace.#saveFaction(root, false);
    }
  }

  static #setAutosaveStatus(root, text) {
    const status = root.querySelector("[data-campaign-autosave-status]");
    if (!(status instanceof HTMLElement)) return;
    status.textContent = text;
    status.hidden = !text;
    status.dataset.state = text === "Unsaved changes"
      ? "error"
      : text === "Saving..." ? "saving" : "saved";
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

  static #paintStoryThreadList(panel) {
    const list = panel.querySelector("[data-story-thread-list]");
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    const threads = StoryThreadService.list()
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    if (!threads.length) {
      const empty = document.createElement("div");
      empty.className = "nd-quest-sidebar__empty";
      empty.textContent = "No Story Threads";
      list.append(empty);
      return;
    }
    for (const thread of threads) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-quest-sidebar__quest";
      button.dataset.storyThreadNavId = thread.id;
      button.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "storyThread" &&
          thread.id === CampaignWorkspace.#storyThreadId
      );
      const title = document.createElement("span");
      title.textContent = thread.title?.trim() || "Untitled Story Thread";
      const status = document.createElement("span");
      status.className = "nd-campaign-status";
      status.dataset.status = thread.status;
      status.textContent = thread.status;
      button.append(title, status);
      list.append(button);
    }
  }

  static #paintStoryThread(panel, thread) {
    const view = panel.querySelector("[data-story-thread-view]");
    if (!(view instanceof HTMLElement)) return;
    view.hidden = !thread;
    if (!thread) return;

    view.dataset.storyThreadId = thread.id;
    const title = view.querySelector("[data-story-thread-title]");
    const status = view.querySelector("[data-story-thread-status]");
    const description = view.querySelector("[data-story-thread-description]");
    const currentState = view.querySelector("[data-story-thread-current-state]");
    if (title instanceof HTMLInputElement) title.value = thread.title ?? "";
    if (status instanceof HTMLSelectElement) status.value = thread.status ?? "ACTIVE";
    if (description instanceof HTMLElement) {
      description.innerHTML = RichText.sanitize(thread.description ?? "");
    }
    if (currentState instanceof HTMLElement) {
      currentState.innerHTML = RichText.sanitize(thread.currentState ?? "");
    }
    view.dataset.storyVisibleReferences = JSON.stringify(
      CampaignWorkspace.#storyReferencePatch(
        EntityMentions.extract(`${thread.description ?? ""}${thread.currentState ?? ""}`)
      )
    );

    const list = view.querySelector("[data-story-entry-list]");
    const entries = QuestEntryService.listForStoryThread(thread.id);
    if (list instanceof HTMLElement) {
      list.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "nd-quest-empty nd-quest-empty--entries";
        empty.textContent = "No Scenes yet.";
        list.append(empty);
      } else {
        for (const entry of entries) list.append(CampaignWorkspace.#entryElement(entry));
      }
    }
    const load = view.querySelector("[data-load-story-entries]");
    if (load instanceof HTMLButtonElement) {
      const imported = new Set(
        PlaybookService.getDocument().beats
          .map((beat) => beat.sourceStoryEntryId)
          .filter(Boolean)
      );
      const available = entries.filter((entry) => !imported.has(entry.id)).length;
      load.disabled = available === 0;
      load.textContent = available > 0
        ? `Load into Play (${available})`
        : "Loaded into Play";
    }

    ContextPanel.paint(
      view.querySelector("[data-context-panel=\"storyThread\"]"),
      ContextEngine.getContext({ kind: "storyThread", id: thread.id }),
      {
        showCampaignMemory: false,
        showCurrentStatus: false,
        showHeader: false
      }
    );

  }

  static #paintFactionList(panel) {
    const list = panel.querySelector("[data-faction-list]");
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    const factions = FactionService.list()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!factions.length) {
      const empty = document.createElement("div");
      empty.className = "nd-quest-sidebar__empty";
      empty.textContent = "No Factions";
      list.append(empty);
      return;
    }
    for (const faction of factions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-quest-sidebar__quest";
      button.dataset.factionNavId = faction.id;
      button.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "faction" &&
          faction.id === CampaignWorkspace.#factionId
      );
      const name = document.createElement("span");
      name.textContent = faction.name?.trim() || "Untitled Faction";
      const reputation = document.createElement("span");
      reputation.className = "nd-campaign-status";
      reputation.dataset.status = faction.playerReputation;
      reputation.textContent = faction.playerReputation;
      button.append(name, reputation);
      list.append(button);
    }
  }

  static #paintFaction(panel, faction) {
    const view = panel.querySelector("[data-faction-view]");
    if (!(view instanceof HTMLElement)) return;
    view.hidden = !faction;
    if (!faction) return;

    view.dataset.factionId = faction.id;
    const name = view.querySelector("[data-faction-name]");
    const icon = view.querySelector("[data-faction-icon]");
    const iconPreview = view.querySelector("[data-faction-icon-preview]");
    const description = view.querySelector("[data-faction-description]");
    const currentStatus = view.querySelector("[data-faction-current-status]");
    const resources = view.querySelector("[data-faction-resources]");
    const reputation = view.querySelector("[data-faction-reputation]");
    if (name instanceof HTMLInputElement) name.value = faction.name ?? "";
    if (icon instanceof HTMLInputElement) icon.value = faction.icon ?? "";
    if (iconPreview instanceof HTMLImageElement) {
      iconPreview.hidden = !faction.icon;
      if (faction.icon) iconPreview.src = faction.icon;
    }
    if (description instanceof HTMLElement) {
      description.innerHTML = RichText.sanitize(faction.description ?? "");
    }
    if (currentStatus instanceof HTMLElement) {
      currentStatus.innerHTML = RichText.sanitize(faction.currentStatus ?? "");
    }
    if (resources instanceof HTMLElement) {
      resources.innerHTML = RichText.sanitize(faction.resources ?? "");
    }
    if (reputation instanceof HTMLSelectElement) {
      reputation.value = faction.playerReputation ?? "NEUTRAL";
    }

    const objectives = view.querySelector("[data-faction-objectives]");
    if (objectives instanceof HTMLElement) {
      objectives.replaceChildren();
      for (const objective of faction.currentObjectives ?? []) {
        objectives.append(CampaignWorkspace.#factionObjectiveElement(objective));
      }
    }

    const leadership = view.querySelector("[data-faction-leadership]");
    if (leadership instanceof HTMLElement) {
      leadership.replaceChildren();
      for (const actorId of faction.leadershipActorIds ?? []) {
        leadership.append(CampaignWorkspace.#factionLeaderElement(actorId));
      }
    }
    const picker = view.querySelector("[data-faction-leader-picker]");
    if (picker instanceof HTMLSelectElement) {
      picker.replaceChildren(new Option("Select an Actor…", ""));
      for (const actor of EntityRegistry.all("actor").sort((a, b) => a.name.localeCompare(b.name))) {
        picker.add(new Option(actor.name, actor.uuid));
      }
    }

    ContextPanel.paint(
      view.querySelector("[data-context-panel=\"faction\"]"),
      ContextEngine.getContext({ kind: "faction", id: faction.id }),
      {
        showCampaignMemory: false,
        showCurrentStatus: false,
        showHeader: false
      }
    );

    const notes = view.querySelector("[data-faction-notes]");
    if (notes instanceof HTMLElement) {
      LiveNotes.attach(notes, `faction:${faction.id}`, {
        memory: true,
        html: true,
        sanitize: RichText.sanitize
      });
    }
  }

  static #factionObjectiveElement(objective) {
    const row = document.createElement("div");
    row.className = "nd-faction-objective";
    row.dataset.factionObjectiveRow = "";
    const editor = document.createElement("div");
    editor.className = "nd-richtext nd-faction-objective__editor";
    editor.dataset.factionObjective = "";
    editor.dataset.richtextEditor = "";
    editor.dataset.placeholder = "What does this Faction want?";
    editor.contentEditable = "true";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", "Faction Objective");
    editor.innerHTML = RichText.sanitize(objective ?? "");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-faction-objective__remove";
    remove.dataset.removeFactionObjective = "";
    remove.setAttribute("aria-label", "Remove objective");
    remove.textContent = "×";
    row.append(editor, remove);
    return row;
  }

  static #factionLeaderElement(actorId) {
    const row = document.createElement("div");
    row.className = "nd-faction-leader";
    row.dataset.factionLeaderId = actorId;
    const actor = EntityRegistry.findByUUID(actorId);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "nd-context-panel__link";
    link.textContent = actor?.name ?? "Missing Actor";
    if (actor) {
      link.dataset.contextKind = "actor";
      link.dataset.contextId = actor.uuid;
    } else {
      link.disabled = true;
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-faction-objective__remove";
    remove.dataset.removeFactionLeader = "";
    remove.setAttribute("aria-label", "Remove leader");
    remove.textContent = "×";
    row.append(link, remove);
    return row;
  }

  static #selectSection(root, section) {
    const allowed = new Set([
      "quests",
      "storyThreads",
      "factions",
      "actors",
      "locations",
      "items",
      "chronicle"
    ]);
    if (!allowed.has(section)) return;
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#section = section;

    if (section === "quests") {
      CampaignWorkspace.#view = "quest";
      CampaignWorkspace.#questId = CampaignWorkspace.#lastSelections.get(section) ?? null;
    } else if (section === "storyThreads") {
      CampaignWorkspace.#view = "storyThread";
      CampaignWorkspace.#storyThreadId =
        CampaignWorkspace.#lastSelections.get(section) ?? null;
    } else if (section === "factions") {
      CampaignWorkspace.#view = "faction";
      CampaignWorkspace.#factionId = CampaignWorkspace.#lastSelections.get(section) ?? null;
    } else if (section === "chronicle") {
      CampaignWorkspace.#view = "memory";
      CampaignWorkspace.#memoryId = CampaignWorkspace.#lastSelections.get(section) ?? null;
    } else {
      CampaignWorkspace.#view = "entity";
      CampaignWorkspace.#entityKind =
        section === "actors" ? "actor" : section === "locations" ? "scene" : "item";
      CampaignWorkspace.#entityId = CampaignWorkspace.#lastSelections.get(section) ?? null;
    }
    CampaignWorkspace.paint(root);
  }

  static #captureScroll(root) {
    const panel = root?.matches?.("[data-campaign-workspace]")
      ? root
      : root?.querySelector?.("[data-campaign-workspace]");
    const scroll = panel?.querySelector?.(".nd-quest-sidebar__scroll");
    if (!(scroll instanceof HTMLElement)) return;
    CampaignWorkspace.#scrollPositions.set(CampaignWorkspace.#section, scroll.scrollTop);
  }

  static #restoreScroll(panel) {
    const scroll = panel.querySelector(".nd-quest-sidebar__scroll");
    if (!(scroll instanceof HTMLElement)) return;
    scroll.scrollTop = CampaignWorkspace.#scrollPositions.get(CampaignWorkspace.#section) ?? 0;
  }

  static #paintCampaignNavigation(panel) {
    panel.querySelectorAll("[data-campaign-section]").forEach((button) => {
      const active = button.getAttribute("data-campaign-section") === CampaignWorkspace.#section;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const quests = panel.querySelector("[data-campaign-nav-panel=\"quests\"]");
    const storyThreads = panel.querySelector("[data-campaign-nav-panel=\"storyThreads\"]");
    const factions = panel.querySelector("[data-campaign-nav-panel=\"factions\"]");
    const entities = panel.querySelector("[data-campaign-nav-panel=\"entities\"]");
    const chronicle = panel.querySelector("[data-campaign-nav-panel=\"chronicle\"]");
    if (quests instanceof HTMLElement) quests.hidden = CampaignWorkspace.#section !== "quests";
    if (storyThreads instanceof HTMLElement) {
      storyThreads.hidden = CampaignWorkspace.#section !== "storyThreads";
    }
    if (factions instanceof HTMLElement) {
      factions.hidden = CampaignWorkspace.#section !== "factions";
    }
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
    if (CampaignWorkspace.#view !== "entity") {
      view.hidden = true;
      return;
    }
    const entity = CampaignWorkspace.#entityId
      ? EntityRegistry.findByUUID(CampaignWorkspace.#entityId)
      : null;
    if (!entity) {
      if (CampaignWorkspace.#view === "entity" && CampaignWorkspace.#entityId) {
        CampaignWorkspace.#lastSelections.delete(CampaignWorkspace.#section);
        CampaignWorkspace.#entityId = null;
      }
      view.hidden = true;
      return;
    }
    const title = view.querySelector("[data-campaign-entity-title]");
    if (title) title.textContent = entity.name;
    ContextPanel.paint(
      view.querySelector("[data-context-panel=\"entity\"]"),
      ContextEngine.getContext({ kind: entity.kind, id: entity.uuid })
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

    ContextPanel.paint(
      editor.querySelector("[data-context-panel=\"quest\"]"),
      ContextEngine.getContext({ kind: "quest", id: quest.id })
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
    if (log instanceof HTMLElement) {
      log.innerHTML = CampaignWorkspace.#sessionLogHtml(memory.sessionLog);
    }
    ContextPanel.paint(
      view.querySelector("[data-context-panel=\"session\"]"),
      ContextEngine.getContext({ kind: "session", id: memory.id })
    );
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
    title.textContent = entry.title?.trim() || "Untitled Scene";
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

    const playActions = document.createElement("div");
    playActions.className = "nd-quest-actions";
    const load = document.createElement("button");
    load.type = "button";
    load.dataset.loadStoryEntry = entry.id;
    const isLoaded = PlaybookService.getDocument().beats.some(
      (beat) => beat.sourceStoryEntryId === entry.id
    );
    load.disabled = isLoaded;
    load.textContent = isLoaded ? "Loaded into Play" : "Load into Play";
    playActions.append(load);
    body.append(playActions);

    const entryContext = ContextEngine.getContext({ kind: "questEntry", id: entry.id });
    const historySection = document.createElement("section");
    historySection.className = "nd-object-history nd-object-history--entry";
    const heading = document.createElement("h3");
    heading.className = "nd-hierarchy-group";
    heading.textContent = "History";
    const historySummary = document.createElement("p");
    historySummary.className = "nd-object-history__summary";
    historySummary.textContent = entryContext.sessions.length > 0
      ? `First seen ${entryContext.sessions[0]?.label}; ` +
        `last seen ${entryContext.lastSeen?.label}.`
      : "No Chronicle appearances yet.";
    const appearances = document.createElement("div");
    appearances.className = "nd-object-history__list";
    if (entryContext.sessions.length > 0) {
      for (const appearance of entryContext.sessions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nd-object-history__item";
        button.dataset.openMemoryId = appearance.id;
        button.textContent = appearance.label;
        appearances.append(button);
      }
    }
    historySection.append(heading, historySummary, appearances);
    body.append(historySection);

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

  static #applyView(panel, quest, memory, storyThread, faction) {
    const questLayout = panel.querySelector("[data-quest-editor]");
    const questEmpty = panel.querySelector("[data-quest-empty]");
    const memoryView = panel.querySelector("[data-memory-view]");
    const entityView = panel.querySelector("[data-campaign-entity-view]");
    const storyThreadView = panel.querySelector("[data-story-thread-view]");
    const factionView = panel.querySelector("[data-faction-view]");
    if (memoryView instanceof HTMLElement) {
      memoryView.hidden = CampaignWorkspace.#view !== "memory" || !memory;
    }
    if (entityView instanceof HTMLElement) {
      entityView.hidden = CampaignWorkspace.#view !== "entity" || !CampaignWorkspace.#entityId;
    }
    if (storyThreadView instanceof HTMLElement) {
      storyThreadView.hidden =
        CampaignWorkspace.#view !== "storyThread" || !storyThread;
    }
    if (factionView instanceof HTMLElement) {
      factionView.hidden = CampaignWorkspace.#view !== "faction" || !faction;
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
      } else if (CampaignWorkspace.#view === "storyThread" && !storyThread) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a Story Thread or create one.";
      } else if (CampaignWorkspace.#view === "faction" && !faction) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a Faction or create one.";
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
      ui.notifications?.error("Could not import session into Chronicle.");
      return;
    }
    const record = result.session;

    if (numberInput instanceof HTMLInputElement) numberInput.value = "";
    if (titleInput instanceof HTMLInputElement) titleInput.value = "";
    if (logInput instanceof HTMLTextAreaElement) logInput.value = "";
    CampaignWorkspace.#setMemoryImportOpen(panel, false);
    CampaignWorkspace.#view = "memory";
    CampaignWorkspace.#section = "chronicle";
    CampaignWorkspace.#memoryId = record.id;
    CampaignWorkspace.#lastSelections.set("chronicle", record.id);
    CampaignWorkspace.paint(root);
    ui.notifications?.info(`Imported Session ${record.sessionNumber} into Chronicle.`);
  }

  static async #saveMemoryLog(root) {
    if (!CampaignWorkspace.#memoryId) return;
    const editor = root.querySelector("[data-memory-session-log]");
    if (!(editor instanceof HTMLElement)) return;
    const safeLog = RichText.sanitize(editor.innerHTML);
    const updated = await CampaignMemoryService.updateSessionLog(
      CampaignWorkspace.#memoryId,
      safeLog
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

    // Scope each toolbar to its editor region so Chronicle does not share the
    // Quest Overview toolbar (RichTextToolbar only binds the first toolbar in a root).
    const questEditor = panel.querySelector("[data-quest-editor]");
    const memoryView = panel.querySelector("[data-memory-view]");
    if (questEditor instanceof HTMLElement) RichTextToolbar.attach(questEditor);
    if (memoryView instanceof HTMLElement) RichTextToolbar.attach(memoryView);

    panel.querySelectorAll("[data-richtext-editor]").forEach((editor) => {
      if (!(editor instanceof HTMLElement) || editor.closest("[aria-hidden=\"true\"]")) return;
      EntityMentions.attach(editor);
      CampaignWorkspace.#mentionEditors.add(editor);
    });
  }

  /**
   * Preserve stored HTML; convert legacy plain-text logs so line breaks survive.
   * @param {string|null|undefined} value
   * @returns {string}
   */
  static #sessionLogHtml(value) {
    const raw = String(value ?? "");
    if (!raw) return "";
    if (/<[a-z][\s\S]*>/i.test(raw) || raw.includes("data-nd-mention")) {
      return RichText.sanitize(raw);
    }
    return RichText.sanitize(
      foundry.utils.escapeHTML(raw).replace(/\r\n|\r|\n/g, "<br>")
    );
  }

  static async #createFaction(root) {
    const faction = await FactionService.create({
      name: "Untitled Faction",
      playerReputation: "NEUTRAL"
    });
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "faction";
    CampaignWorkspace.#section = "factions";
    CampaignWorkspace.#factionId = faction.id;
    CampaignWorkspace.#lastSelections.set("factions", faction.id);
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => root.querySelector("[data-faction-name]")?.focus());
  }

  static async #saveFaction(root, repaint = true) {
    const view = root.querySelector("[data-faction-view]");
    if (!(view instanceof HTMLElement)) return;
    const id = view.dataset.factionId;
    if (!id) return;
    const name = view.querySelector("[data-faction-name]");
    const icon = view.querySelector("[data-faction-icon]");
    const description = view.querySelector("[data-faction-description]");
    const currentStatus = view.querySelector("[data-faction-current-status]");
    const resources = view.querySelector("[data-faction-resources]");
    const reputation = view.querySelector("[data-faction-reputation]");
    const notes = view.querySelector("[data-faction-notes]");
    const safeDescription = description instanceof HTMLElement
      ? RichText.sanitize(description.innerHTML)
      : "";
    const safeStatus = currentStatus instanceof HTMLElement
      ? RichText.sanitize(currentStatus.innerHTML)
      : "";
    const safeResources = resources instanceof HTMLElement
      ? RichText.sanitize(resources.innerHTML)
      : "";
    const currentObjectives = [...view.querySelectorAll("[data-faction-objective]")]
      .filter((objective) => objective instanceof HTMLElement)
      .map((objective) => RichText.sanitize(objective.innerHTML))
      .filter((objective) => RichText.hasContent(objective));
    const leadershipActorIds = [...view.querySelectorAll("[data-faction-leader-id]")]
      .map((row) => row.getAttribute("data-faction-leader-id"))
      .filter(Boolean);
    const mentionHtml = [
      safeDescription,
      safeStatus,
      safeResources,
      notes instanceof HTMLElement ? RichText.sanitize(notes.innerHTML) : "",
      ...currentObjectives
    ].join("");
    await FactionService.update(id, {
      name: name instanceof HTMLInputElement ? name.value.trim() : "",
      icon: icon instanceof HTMLInputElement ? icon.value.trim() : "",
      description: safeDescription,
      currentStatus: safeStatus,
      currentObjectives,
      resources: safeResources,
      playerReputation: reputation instanceof HTMLSelectElement
        ? reputation.value
        : "NEUTRAL",
      leadershipActorIds,
      ...CampaignWorkspace.#factionReferencePatch(
        EntityMentions.extract(mentionHtml),
        id,
        leadershipActorIds
      )
    });
    if (repaint) CampaignWorkspace.paint(root);
  }

  static #factionReferencePatch(mentions, factionId, leadershipActorIds) {
    const ids = (kind, preferUuid) =>
      mentions
        .filter((mention) => mention.kind === kind)
        .map((mention) => (preferUuid ? mention.uuid : mention.id) || mention.id)
        .filter(Boolean);
    const leaders = new Set(leadershipActorIds);
    return {
      relatedActorIds: ids("actor", true).filter((id) => !leaders.has(id)),
      relatedStoryThreadIds: ids("storyThread", false),
      relatedItemIds: ids("item", true),
      relatedLocationIds: ids("scene", true),
      relatedQuestIds: ids("quest", false),
      relatedSessionIds: ids("session", false),
      relatedFactionIds: ids("faction", false).filter((id) => id !== factionId)
    };
  }

  static async #createStoryThread(root) {
    const thread = await StoryThreadService.create({
      title: "Untitled Story Thread",
      status: "ACTIVE"
    });
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "storyThread";
    CampaignWorkspace.#section = "storyThreads";
    CampaignWorkspace.#storyThreadId = thread.id;
    CampaignWorkspace.#lastSelections.set("storyThreads", thread.id);
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => root.querySelector("[data-story-thread-title]")?.focus());
  }

  static async #saveStoryThread(root, repaint = true) {
    const view = root.querySelector("[data-story-thread-view]");
    if (!(view instanceof HTMLElement)) return;
    const id = view.dataset.storyThreadId;
    if (!id) return;
    const title = view.querySelector("[data-story-thread-title]");
    const status = view.querySelector("[data-story-thread-status]");
    const description = view.querySelector("[data-story-thread-description]");
    const currentState = view.querySelector("[data-story-thread-current-state]");
    const safeDescription = description instanceof HTMLElement
      ? RichText.sanitize(description.innerHTML)
      : "";
    const safeCurrentState = currentState instanceof HTMLElement
      ? RichText.sanitize(currentState.innerHTML)
      : "";
    const mentionHtml = [safeDescription, safeCurrentState].join("");
    const detectedReferences = CampaignWorkspace.#storyReferencePatch(
      EntityMentions.extract(mentionHtml)
    );
    const existing = StoryThreadService.getById(id);
    let previousVisibleReferences = {};
    try {
      previousVisibleReferences = JSON.parse(view.dataset.storyVisibleReferences ?? "{}");
    } catch {
      previousVisibleReferences = {};
    }
    const references = CampaignWorkspace.#mergeStoryReferences(
      existing,
      previousVisibleReferences,
      detectedReferences
    );
    await StoryThreadService.update(id, {
      title: title instanceof HTMLInputElement ? title.value.trim() : "",
      status: status instanceof HTMLSelectElement ? status.value : "ACTIVE",
      description: safeDescription,
      currentState: safeCurrentState,
      ...references
    });
    if (repaint) CampaignWorkspace.paint(root);
  }

  static #storyReferencePatch(mentions) {
    const ids = (kind, preferUuid) =>
      mentions
        .filter((mention) => mention.kind === kind)
        .map((mention) => (preferUuid ? mention.uuid : mention.id) || mention.id)
        .filter(Boolean);
    return {
      relatedActorIds: ids("actor", true),
      relatedLocationIds: ids("scene", true),
      relatedItemIds: ids("item", true),
      relatedQuestIds: ids("quest", false),
      relatedSessionIds: ids("session", false)
    };
  }

  static #mergeStoryReferences(existing, previousVisible, nextVisible) {
    const result = {};
    for (const key of [
      "relatedActorIds",
      "relatedLocationIds",
      "relatedItemIds",
      "relatedQuestIds",
      "relatedSessionIds"
    ]) {
      const prior = new Set(Array.isArray(previousVisible?.[key]) ? previousVisible[key] : []);
      const preserved = (Array.isArray(existing?.[key]) ? existing[key] : [])
        .filter((id) => !prior.has(id));
      result[key] = [...new Set([...preserved, ...(nextVisible[key] ?? [])])];
    }
    return result;
  }

  static async #createQuest(root, category) {
    const quest = await ThreadService.create({
      title: "Untitled Quest",
      status: "OPEN",
      category,
      overview: ""
    });
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#questId = quest.id;
    CampaignWorkspace.#view = "quest";
    CampaignWorkspace.#section = "quests";
    CampaignWorkspace.#lastSelections.set("quests", quest.id);
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => root.querySelector("[data-quest-title]")?.focus());
  }

  static async #saveQuest(root, repaint = true) {
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
    if (repaint) CampaignWorkspace.paint(root);
  }

  static async #createEntry(root) {
    if (!CampaignWorkspace.#storyThreadId) return;
    const entry = await QuestEntryService.create(CampaignWorkspace.#storyThreadId);
    if (!entry) return;
    CampaignWorkspace.#openEntryId = entry.id;
    CampaignWorkspace.paint(root);
  }

  static async #loadStoryEntries(root) {
    if (!CampaignWorkspace.#storyThreadId) return;
    await CampaignWorkspace.flush(root);
    const entries = QuestEntryService.listForStoryThread(
      CampaignWorkspace.#storyThreadId
    );
    await PlaybookService.importStoryEntries(entries);
    CampaignWorkspace.paint(root);
  }

  static async #loadStoryEntry(root, id) {
    const entry = QuestEntryService.getById(id);
    if (!entry || entry.storyThreadId !== CampaignWorkspace.#storyThreadId) return;
    await CampaignWorkspace.flush(root);
    await PlaybookService.importStoryEntries([QuestEntryService.getById(id)]);
    CampaignWorkspace.#openEntryId = id;
    CampaignWorkspace.paint(root);
  }

  static async #saveEntry(root, id, repaint = true) {
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
    if (repaint) CampaignWorkspace.paint(root);
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
