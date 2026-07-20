import { CampaignMemoryService } from "./campaign-memory-service.js";
import { ContextEngine } from "./context-engine.js";
import { ContextPanel } from "./context-panel.js";
import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { LiveNotes } from "./live-notes.js";
import { NavigationHistory } from "./navigation-history.js";
import { Playbook } from "./playbook.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { QuickEdit } from "./quick-edit.js";
import { RelationshipExplorer } from "./relationship-explorer.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";
import { StoryThreadService } from "./story-thread-service.js";

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
 * Quests are Story-Thread-owned playable content presented in one Explorer.
 */
export class CampaignWorkspace {
  /** @type {"storyThread"|"faction"|"memory"|"entity"} */
  static #view = "storyThread";

  /** @type {"storyThreads"|"factions"|"actors"|"locations"|"items"|"chronicle"} */
  static #section = "storyThreads";

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

  /** @type {Set<string>} */
  static #expandedStoryThreads = new Set();

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
    return null;
  }

  /** @returns {string|null} */
  static getSelectedQuestId() {
    return CampaignWorkspace.getSelectedThreadId();
  }

  /** @returns {string|null} */
  static getSelectedQuestEntryId() {
    return CampaignWorkspace.#openEntryId;
  }

  /**
   * Current Campaign focus for Relationship Explorer breadcrumbs.
   * @returns {{ kind: string, id: string, label: string }|null}
   */
  static getFocusTarget() {
    if (CampaignWorkspace.#view === "storyThread" && CampaignWorkspace.#openEntryId) {
      const entry = QuestEntryService.getById(CampaignWorkspace.#openEntryId);
      if (entry) {
        return {
          kind: "questEntry",
          id: entry.id,
          label: entry.title?.trim() || "Untitled Quest"
        };
      }
    }
    if (CampaignWorkspace.#view === "storyThread" && CampaignWorkspace.#storyThreadId) {
      const thread = StoryThreadService.getById(CampaignWorkspace.#storyThreadId);
      if (thread) {
        return {
          kind: "storyThread",
          id: thread.id,
          label: thread.title?.trim() || "Untitled Story Thread"
        };
      }
    }
    if (CampaignWorkspace.#view === "faction" && CampaignWorkspace.#factionId) {
      const faction = FactionService.getById(CampaignWorkspace.#factionId);
      if (faction) {
        return {
          kind: "faction",
          id: faction.id,
          label: faction.name?.trim() || "Untitled Faction"
        };
      }
    }
    if (CampaignWorkspace.#view === "memory" && CampaignWorkspace.#memoryId) {
      const memory = CampaignMemoryService.getById(CampaignWorkspace.#memoryId);
      if (memory) {
        const title = memory.title?.trim();
        return {
          kind: "session",
          id: memory.id,
          label: title
            ? `Session ${memory.sessionNumber} · ${title}`
            : `Session ${memory.sessionNumber}`
        };
      }
    }
    if (
      CampaignWorkspace.#view === "entity" &&
      CampaignWorkspace.#entityKind &&
      CampaignWorkspace.#entityId
    ) {
      const entity = EntityRegistry.findByUUID(CampaignWorkspace.#entityId);
      if (entity) {
        const kind =
          entity.kind === "scene" ? "location" : entity.kind;
        return {
          kind,
          id: entity.uuid,
          label: entity.name?.trim() || "Untitled"
        };
      }
    }
    return null;
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
    const owner = StoryThreadService.list().find(
      (thread) => (thread.relatedQuestIds ?? []).includes(id)
    );
    return owner ? CampaignWorkspace.selectStoryThread(root, owner.id) : false;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   */
  static selectQuestEntry(root, id) {
    const entry = QuestEntryService.getById(id);
    if (!entry) return false;
    if (!StoryThreadService.getById(entry.storyThreadId)) return false;
    void CampaignWorkspace.flush(root).catch(() => {});
    CampaignWorkspace.#captureScroll(root);
    CampaignWorkspace.#view = "storyThread";
    CampaignWorkspace.#section = "storyThreads";
    CampaignWorkspace.#storyThreadId = entry.storyThreadId;
    CampaignWorkspace.#lastSelections.set("storyThreads", entry.storyThreadId);
    CampaignWorkspace.#expandedStoryThreads.add(entry.storyThreadId);
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
    CampaignWorkspace.#openEntryId = null;
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

    CampaignWorkspace.#paintStoryThreadList(panel);
    CampaignWorkspace.#paintFactionList(panel);
    CampaignWorkspace.#paintMemoryList(panel);
    CampaignWorkspace.#paintCampaignNavigation(panel);
    CampaignWorkspace.#paintEntityList(panel);

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
    CampaignWorkspace.#applyView(panel, memory, storyThread, faction);
    CampaignWorkspace.#attachRichEditors(panel);
    CampaignWorkspace.#restoreScroll(panel);
    NavigationHistory.syncCurrent(CampaignWorkspace.getFocusTarget());
    RelationshipExplorer.paintChrome(root);
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

        const storyThreadToggle = target.closest("[data-story-thread-toggle-id]");
        if (storyThreadToggle) {
          const id = storyThreadToggle.getAttribute("data-story-thread-toggle-id");
          if (id) CampaignWorkspace.#toggleStoryThread(root, id);
          return;
        }

        const deleteStoryThread = target.closest("[data-delete-story-thread]");
        if (deleteStoryThread) {
          const id = deleteStoryThread.getAttribute("data-delete-story-thread");
          if (id) void CampaignWorkspace.#deleteStoryThread(root, id);
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

        if (target.closest("[data-add-story-entry]")) {
          void CampaignWorkspace.#createEntry(root);
          return;
        }

        const loadStoryEntry = target.closest("[data-load-story-entry]");
        if (loadStoryEntry) {
          const id = loadStoryEntry.getAttribute("data-load-story-entry");
          if (id) void CampaignWorkspace.#loadStoryEntry(root, id, true);
          return;
        }

        const explorerLoad = target.closest("[data-explorer-load-entry]");
        if (explorerLoad) {
          const id = explorerLoad.getAttribute("data-explorer-load-entry");
          if (id) void CampaignWorkspace.#loadStoryEntry(root, id);
          return;
        }

        const unloadStoryEntry = target.closest("[data-unload-story-entry]");
        if (unloadStoryEntry) {
          const id = unloadStoryEntry.getAttribute("data-unload-story-entry");
          if (id) void CampaignWorkspace.#unloadStoryEntry(root, id);
          return;
        }

        const deleteQuest = target.closest("[data-delete-story-entry]");
        if (deleteQuest) {
          const id = deleteQuest.getAttribute("data-delete-story-entry");
          if (id) void CampaignWorkspace.#deleteEntry(root, id);
          return;
        }

        const openOwner = target.closest("[data-open-story-thread-id]");
        if (openOwner) {
          const id = openOwner.getAttribute("data-open-story-thread-id");
          if (id) CampaignWorkspace.selectStoryThread(root, id);
          return;
        }

        const indexedQuest = target.closest("[data-quest-index-id]");
        if (indexedQuest) {
          const id = indexedQuest.getAttribute("data-quest-index-id");
          if (id) CampaignWorkspace.selectQuestEntry(root, id);
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
      "dblclick",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const quest = target.closest("[data-explorer-quest-id]");
        const id = quest?.getAttribute("data-explorer-quest-id");
        if (id) void CampaignWorkspace.#loadStoryEntry(root, id);
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

  static #paintStoryThreadList(panel) {
    const list = panel.querySelector("[data-story-thread-list]");
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    const threads = StoryThreadService.list()
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const entries = QuestEntryService.list();
    const loadedIds = new Set(
      PlaybookService.getDocument().beats
        .map((beat) => beat.sourceStoryEntryId)
        .filter(Boolean)
    );
    const liveId = PlaybookService.getLiveSourceEntryId();
    const liveEntry = entries.find((entry) => entry.id === liveId);
    if (liveEntry?.storyThreadId) {
      CampaignWorkspace.#expandedStoryThreads.add(liveEntry.storyThreadId);
    }
    if (!threads.length) {
      const empty = document.createElement("div");
      empty.className = "nd-quest-sidebar__empty";
      empty.textContent = "No Story Threads";
      list.append(empty);
      return;
    }
    for (const thread of threads) {
      const branch = document.createElement("div");
      branch.className = "nd-explorer-thread";
      branch.dataset.storyThreadBranchId = thread.id;

      const header = document.createElement("div");
      header.className = "nd-explorer-thread__header";

      const expanded = CampaignWorkspace.#expandedStoryThreads.has(thread.id);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "nd-explorer-thread__toggle";
      toggle.dataset.storyThreadToggleId = thread.id;
      toggle.setAttribute("aria-label", expanded ? "Collapse Story Thread" : "Expand Story Thread");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = expanded ? "▼" : "▶";

      const threadDot = document.createElement("span");
      threadDot.className = "nd-entity-dot";
      threadDot.dataset.entityKind = "storyThread";
      threadDot.setAttribute("aria-hidden", "true");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-explorer-thread__name";
      button.dataset.storyThreadNavId = thread.id;
      button.dataset.entityKind = "storyThread";
      button.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "storyThread" &&
          thread.id === CampaignWorkspace.#storyThreadId
      );
      button.replaceChildren();
      button.append(
        document.createTextNode(thread.title?.trim() || "Untitled Story Thread")
      );

      const status = QuickEdit.badge(thread.status, {
        kind: "storyThread",
        id: thread.id,
        field: "status"
      });

      const menu = document.createElement("details");
      menu.className = "nd-explorer-menu";
      const menuToggle = document.createElement("summary");
      menuToggle.setAttribute("aria-label", "Story Thread actions");
      menuToggle.textContent = "⋯";
      const menuContent = document.createElement("div");
      menuContent.className = "nd-explorer-menu__content";
      const removeThread = document.createElement("button");
      removeThread.type = "button";
      removeThread.dataset.deleteStoryThread = thread.id;
      removeThread.textContent = "Delete Story Thread";
      menuContent.append(removeThread);
      menu.append(menuToggle, menuContent);

      header.append(toggle, threadDot, button, status, menu);
      QuickEdit.mount(header, {
        kind: "storyThread",
        id: thread.id,
        fields: ["status", "currentState"]
      });

      const children = document.createElement("div");
      children.className = "nd-explorer-thread__children";
      children.hidden = !expanded;
      const threadEntries = entries
        .filter((entry) => entry.storyThreadId === thread.id)
        .sort((a, b) => a.title.localeCompare(b.title));
      if (!threadEntries.length) {
        const empty = document.createElement("div");
        empty.className = "nd-explorer-thread__empty";
        empty.textContent = "No Quests";
        children.append(empty);
      } else {
        for (const entry of threadEntries) {
          children.append(
            CampaignWorkspace.#explorerQuestRow(entry, {
              loaded: loadedIds.has(entry.id),
              live: entry.id === liveId
            })
          );
        }
      }

      branch.append(header, children);
      list.append(branch);
    }
  }

  static #explorerQuestRow(entry, { loaded, live }) {
    const row = document.createElement("div");
    row.className = "nd-explorer-quest";
    row.dataset.entityKind = "quest";
    row.classList.toggle("is-active", entry.id === CampaignWorkspace.#openEntryId);
    row.classList.toggle("is-live", live);

    const questDot = document.createElement("span");
    questDot.className = "nd-entity-dot";
    questDot.dataset.entityKind = "quest";
    questDot.setAttribute("aria-hidden", "true");

    const open = document.createElement("button");
    open.type = "button";
    open.className = "nd-explorer-quest__name";
    open.dataset.questIndexId = entry.id;
    open.dataset.explorerQuestId = entry.id;
    open.replaceChildren();
    open.append(document.createTextNode(entry.title?.trim() || "Untitled Quest"));

    const status = QuickEdit.badge(entry.status, {
      kind: "questEntry",
      id: entry.id,
      field: "status"
    });

    const state = document.createElement("span");
    state.className = "nd-explorer-quest__state";
    state.classList.toggle("is-live", live);
    state.textContent = live ? "● LIVE" : "";

    const playAction = document.createElement("button");
    playAction.type = "button";
    playAction.className = "nd-explorer-quest__action";
    if (loaded) {
      playAction.dataset.unloadStoryEntry = entry.id;
      playAction.title = "Remove from Play";
      playAction.setAttribute("aria-label", "Remove from Play");
      playAction.textContent = "✕";
      playAction.classList.add("nd-explorer-quest__unload");
    } else {
      playAction.dataset.explorerLoadEntry = entry.id;
      playAction.title = "Load into Play";
      playAction.setAttribute("aria-label", "Load into Play");
      playAction.textContent = "▶";
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-explorer-quest__action nd-explorer-quest__delete";
    remove.dataset.deleteStoryEntry = entry.id;
    remove.title = "Delete Quest";
    remove.setAttribute("aria-label", "Delete Quest");
    remove.textContent = "×";

    row.append(questDot, open, status, state, playAction, remove);
    QuickEdit.mount(row, {
      kind: "questEntry",
      id: entry.id,
      fields: ["status", "currentStatus"]
    });
    return row;
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
    const questEditor = view.querySelector("[data-story-quest-editor]");
    const entries = QuestEntryService.listForStoryThread(thread.id);
    if (list instanceof HTMLElement) {
      list.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "nd-quest-empty nd-quest-empty--entries";
        empty.textContent = "No Quests yet.";
        list.append(empty);
      } else {
        for (const entry of entries) {
          list.append(CampaignWorkspace.#storyQuestRow(entry));
        }
      }
    }
    if (questEditor instanceof HTMLElement) {
      questEditor.replaceChildren();
      const selected = entries.find((entry) => entry.id === CampaignWorkspace.#openEntryId);
      if (selected) questEditor.append(CampaignWorkspace.#entryElement(selected));
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

    QuickEdit.mount(view, {
      kind: "storyThread",
      id: thread.id,
      fields: ["status", "currentState"]
    });
  }

  static #storyQuestRow(entry) {
    const row = document.createElement("div");
    row.className = "nd-story-quest-row";
    row.classList.toggle("is-active", entry.id === CampaignWorkspace.#openEntryId);

    const title = document.createElement("strong");
    title.textContent = entry.title?.trim() || "Untitled Quest";

    const status = QuickEdit.badge(entry.status, {
      kind: "questEntry",
      id: entry.id,
      field: "status"
    });

    const open = document.createElement("button");
    open.type = "button";
    open.dataset.questIndexId = entry.id;
    open.textContent = "Open";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-story-quest-row__delete";
    remove.dataset.deleteStoryEntry = entry.id;
    remove.textContent = "Delete";

    row.append(title, status, open, remove);
    QuickEdit.mount(row, {
      kind: "questEntry",
      id: entry.id,
      fields: ["status", "currentStatus"]
    });
    return row;
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
      const row = document.createElement("div");
      row.className = "nd-quest-sidebar__quest nd-faction-nav-row";
      row.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "faction" &&
          faction.id === CampaignWorkspace.#factionId
      );

      const dot = document.createElement("span");
      dot.className = "nd-entity-dot";
      dot.dataset.entityKind = "faction";
      dot.setAttribute("aria-hidden", "true");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-faction-nav-row__name";
      button.dataset.factionNavId = faction.id;
      button.textContent = faction.name?.trim() || "Untitled Faction";

      const reputation = QuickEdit.badge(faction.playerReputation, {
        kind: "faction",
        id: faction.id,
        field: "reputation"
      });
      row.append(dot, button, reputation);
      QuickEdit.mount(row, {
        kind: "faction",
        id: faction.id,
        fields: ["reputation", "currentStatus"]
      });
      list.append(row);
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

    QuickEdit.mount(view, {
      kind: "faction",
      id: faction.id,
      fields: ["reputation", "currentStatus"]
    });
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

    if (section === "storyThreads") {
      CampaignWorkspace.#view = "storyThread";
      CampaignWorkspace.#storyThreadId =
        CampaignWorkspace.#lastSelections.get(section) ?? null;
      CampaignWorkspace.#openEntryId = null;
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
    const storyThreads = panel.querySelector("[data-campaign-nav-panel=\"storyThreads\"]");
    const factions = panel.querySelector("[data-campaign-nav-panel=\"factions\"]");
    const entities = panel.querySelector("[data-campaign-nav-panel=\"entities\"]");
    const chronicle = panel.querySelector("[data-campaign-nav-panel=\"chronicle\"]");
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
    const factionBlock = panel.querySelector("[data-campaign-actor-factions]");
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
    } else {
      for (const entity of entities) {
        const row = document.createElement("div");
        row.className = "nd-quest-sidebar__quest nd-entity-nav-row";
        row.classList.toggle("is-active", entity.uuid === CampaignWorkspace.#entityId);

        const entityKind = entity.kind === "scene" ? "location" : entity.kind;
        const dot = document.createElement("span");
        dot.className = "nd-entity-dot";
        dot.dataset.entityKind = entityKind;
        dot.setAttribute("aria-hidden", "true");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "nd-entity-nav-row__name";
        button.dataset.campaignEntityId = entity.uuid;
        button.textContent = entity.name;

        row.append(dot, button);
        QuickEdit.mount(row, {
          kind: entityKind,
          id: entity.uuid,
          fields: ["currentStatus"]
        });
        list.append(row);
      }
    }

    if (factionBlock instanceof HTMLElement) {
      const showFactions = CampaignWorkspace.#section === "actors";
      factionBlock.hidden = !showFactions;
      if (showFactions) CampaignWorkspace.#paintActorFactionList(panel);
    }
  }

  static #paintActorFactionList(panel) {
    const list = panel.querySelector("[data-campaign-actor-faction-list]");
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
      const row = document.createElement("div");
      row.className = "nd-quest-sidebar__quest nd-faction-nav-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-faction-nav-row__name";
      button.dataset.factionNavId = faction.id;
      button.textContent = faction.name?.trim() || "Untitled Faction";

      const type = document.createElement("span");
      type.className = "nd-rel-type";
      type.dataset.relType = "faction";
      type.textContent = "Faction";

      const reputation = QuickEdit.badge(faction.playerReputation, {
        kind: "faction",
        id: faction.id,
        field: "reputation"
      });
      row.append(type, button, reputation);
      list.append(row);
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
    if (title) {
      title.replaceChildren();
      title.append(document.createTextNode(entity.name));
    }
    ContextPanel.paint(
      view.querySelector("[data-context-panel=\"entity\"]"),
      ContextEngine.getContext({ kind: entity.kind, id: entity.uuid })
    );
    const entityKind = entity.kind === "scene" ? "location" : entity.kind;
    QuickEdit.mount(view, {
      kind: entityKind,
      id: entity.uuid,
      fields: ["currentStatus"]
    });
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
    const status = QuickEdit.badge(entry.status, {
      kind: "questEntry",
      id: entry.id,
      field: "status"
    });
    const title = document.createElement("strong");
    title.textContent = entry.title?.trim() || "Untitled Quest";
    summary.append(status, title);

    const body = document.createElement("div");
    body.className = "nd-quest-entry__body";

    const owner = StoryThreadService.getById(entry.storyThreadId);
    const ownerBlock = document.createElement("div");
    ownerBlock.className = "nd-quest-entry__owner";
    const ownerLabel = document.createElement("div");
    ownerLabel.className = "nd-quest-entry__owner-label";
    ownerLabel.textContent = "Story Thread";
    const ownerButton = document.createElement("button");
    ownerButton.type = "button";
    ownerButton.className = "nd-context-panel__link";
    ownerButton.dataset.openStoryThreadId = entry.storyThreadId;
    ownerButton.textContent = owner?.title?.trim() || "Unknown Story Thread";
    ownerBlock.append(ownerLabel, ownerButton);
    body.append(ownerBlock);

    const headingFields = document.createElement("div");
    headingFields.className = "nd-campaign-thread-fields";
    headingFields.append(
      CampaignWorkspace.#inputField("Title", "title", entry.title, true),
      CampaignWorkspace.#statusField(entry.status),
      CampaignWorkspace.#categoryField(entry.category)
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
    playActions.className = "nd-quest-entry__actions";
    const isLoaded = PlaybookService.isLoaded(entry.id);
    const isLive = PlaybookService.getLiveSourceEntryId() === entry.id;
    const load = document.createElement("button");
    load.type = "button";
    if (isLoaded) {
      load.dataset.unloadStoryEntry = entry.id;
      load.textContent = isLive ? "Remove from Play (LIVE)" : "Remove from Play";
    } else {
      load.dataset.loadStoryEntry = entry.id;
      load.textContent = "Load into Play";
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-quest-entry__delete";
    remove.dataset.deleteStoryEntry = entry.id;
    remove.textContent = "Delete Quest";
    playActions.append(load, remove);
    body.append(playActions);

    const entryContext = document.createElement("section");
    entryContext.dataset.contextPanel = "questEntry";
    body.append(entryContext);
    ContextPanel.paint(
      entryContext,
      ContextEngine.getContext({ kind: "questEntry", id: entry.id }),
      {
        showCampaignMemory: false,
        showCurrentStatus: false,
        showHeader: false
      }
    );

    details.append(summary, body);
    QuickEdit.mount(details, {
      kind: "questEntry",
      id: entry.id,
      fields: ["status", "currentStatus"]
    });
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

  static #categoryField(value) {
    const wrapper = document.createElement("label");
    wrapper.className = "nd-campaign-field";
    const text = document.createElement("span");
    text.textContent = "Category";
    const select = document.createElement("select");
    select.dataset.entryField = "category";
    for (const category of ["MAIN", "SIDE", "COMPANION"]) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      option.selected = category === (value || "SIDE");
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
      ["Quests", record.relatedBeatIds ?? [], "beat"],
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

  static #applyView(panel, memory, storyThread, faction) {
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
    if (questEmpty instanceof HTMLElement) {
      questEmpty.hidden = true;
      if (CampaignWorkspace.#view === "memory" && !memory) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select an archived session or import a Session Log.";
      } else if (CampaignWorkspace.#view === "entity" && !CampaignWorkspace.#entityId) {
        questEmpty.hidden = false;
        questEmpty.textContent = `Select an object to view its History.`;
      } else if (
        CampaignWorkspace.#view === "storyThread" &&
        !storyThread
      ) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a Story Thread or create one.";
      } else if (CampaignWorkspace.#view === "faction" && !faction) {
        questEmpty.hidden = false;
        questEmpty.textContent = "Select a Faction or create one.";
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

    // Scope the Chronicle toolbar to its editor region.
    const memoryView = panel.querySelector("[data-memory-view]");
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
    CampaignWorkspace.#expandedStoryThreads.add(thread.id);
    CampaignWorkspace.#lastSelections.set("storyThreads", thread.id);
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => root.querySelector("[data-story-thread-title]")?.focus());
  }

  static #toggleStoryThread(root, id) {
    if (!StoryThreadService.getById(id)) return;
    const liveEntryId = PlaybookService.getCurrent().beat?.sourceStoryEntryId ?? "";
    const liveEntry = liveEntryId ? QuestEntryService.getById(liveEntryId) : null;
    if (
      CampaignWorkspace.#expandedStoryThreads.has(id) &&
      liveEntry?.storyThreadId === id
    ) {
      return;
    }
    const expanded = !CampaignWorkspace.#expandedStoryThreads.has(id);
    if (expanded) CampaignWorkspace.#expandedStoryThreads.add(id);
    else CampaignWorkspace.#expandedStoryThreads.delete(id);

    const branch = root.querySelector(`[data-story-thread-branch-id="${id}"]`);
    const children = branch?.querySelector(".nd-explorer-thread__children");
    const toggle = branch?.querySelector("[data-story-thread-toggle-id]");
    if (children instanceof HTMLElement) children.hidden = !expanded;
    if (toggle instanceof HTMLButtonElement) {
      toggle.textContent = expanded ? "▼" : "▶";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute("aria-label", expanded ? "Collapse Story Thread" : "Expand Story Thread");
    }
  }

  static async #deleteStoryThread(root, id) {
    const thread = StoryThreadService.getById(id);
    if (!thread) return;
    const quests = QuestEntryService.listForStoryThread(id);
    const label = thread.title?.trim() || "Untitled Story Thread";
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Story Thread" },
      content:
        `<p>Delete Story Thread <strong>${foundry.utils.escapeHTML(label)}</strong>?</p>` +
        `<p>This also removes ${quests.length} ${quests.length === 1 ? "Quest" : "Quests"}, ` +
        `their Play imports, and related references.</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;
    await CampaignWorkspace.flush(root);
    if (!await StoryThreadService.delete(id)) return;
    CampaignWorkspace.#expandedStoryThreads.delete(id);
    if (CampaignWorkspace.#storyThreadId === id) {
      CampaignWorkspace.#storyThreadId = null;
      CampaignWorkspace.#openEntryId = null;
    }
    if (CampaignWorkspace.#lastSelections.get("storyThreads") === id) {
      CampaignWorkspace.#lastSelections.delete("storyThreads");
    }
    CampaignWorkspace.paint(root);
    Playbook.refreshOpen();
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

  static async #createEntry(root) {
    if (!CampaignWorkspace.#storyThreadId) return;
    const entry = await QuestEntryService.create(CampaignWorkspace.#storyThreadId);
    if (!entry) return;
    CampaignWorkspace.#expandedStoryThreads.add(entry.storyThreadId);
    CampaignWorkspace.#openEntryId = entry.id;
    CampaignWorkspace.#lastSelections.set("storyThreads", entry.storyThreadId);
    CampaignWorkspace.paint(root);
  }

  static async #deleteEntry(root, id) {
    const entry = QuestEntryService.getById(id);
    if (!entry) return;
    const label = entry.title?.trim() || "Untitled Quest";
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Quest" },
      content: `<p>Delete quest <strong>${foundry.utils.escapeHTML(label)}</strong>?</p>` +
        `<p>This removes it from the Explorer, Play imports, Search, and related references.</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;
    await CampaignWorkspace.flush(root).catch(() => {});
    const removed = await QuestEntryService.delete(id);
    if (!removed) return;
    if (CampaignWorkspace.#openEntryId === id) CampaignWorkspace.#openEntryId = null;
    CampaignWorkspace.paint(root);
    Playbook.refreshOpen();
  }

  static async #loadStoryEntry(root, id, open = false) {
    const entry = QuestEntryService.getById(id);
    if (!entry) return;
    await CampaignWorkspace.flush(root);
    await PlaybookService.importStoryEntries([QuestEntryService.getById(id)]);
    CampaignWorkspace.#expandedStoryThreads.add(entry.storyThreadId);
    if (open) {
      CampaignWorkspace.#storyThreadId = entry.storyThreadId;
      CampaignWorkspace.#openEntryId = id;
    }
    CampaignWorkspace.paint(root);
    Playbook.refreshOpen();
  }

  static async #unloadStoryEntry(root, id) {
    if (!PlaybookService.isLoaded(id)) return;
    await CampaignWorkspace.flush(root).catch(() => {});
    await PlaybookService.removeFromPlay(id);
    CampaignWorkspace.paint(root);
    Playbook.refreshOpen();
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
    if (PlaybookService.isLoaded(id)) Playbook.refreshOpen();
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
