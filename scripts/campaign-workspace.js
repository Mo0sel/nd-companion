import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";
import { PlaybookService } from "./playbook-service.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";
import { SessionService } from "./session-service.js";
import { ThreadService } from "./thread-service.js";

/**
 * Lightweight browser/editor for the Campaign model.
 * UI state is intentionally local; campaign data remains service-owned.
 */
export class CampaignWorkspace {
  /** @type {"session"|"threads"|"thread"} */
  static #view = "session";

  /** @type {string|null} */
  static #threadId = null;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /** @type {HTMLElement|null} */
  static #mentionEditor = null;

  /** @returns {string|null} */
  static getSelectedThreadId() {
    return CampaignWorkspace.#view === "thread" ? CampaignWorkspace.#threadId : null;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   * @returns {boolean}
   */
  static selectThread(root, id) {
    if (!ThreadService.getById(id)) return false;
    CampaignWorkspace.#view = "thread";
    CampaignWorkspace.#threadId = id;
    CampaignWorkspace.paint(root);
    return true;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} id
   * @returns {boolean}
   */
  static selectSession(root, id) {
    if (!SessionService.getById(id)) return false;
    CampaignWorkspace.#view = "session";
    CampaignWorkspace.#threadId = null;
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
    const threads = ThreadService.list().sort((a, b) => b.updated - a.updated);

    CampaignWorkspace.#paintHeader(panel, session);
    CampaignWorkspace.#paintSidebar(panel, session, threads);
    CampaignWorkspace.#paintSession(panel, session);
    CampaignWorkspace.#paintThreadList(panel, threads);

    const selectedThread = CampaignWorkspace.#threadId
      ? ThreadService.getById(CampaignWorkspace.#threadId)
      : null;
    if (CampaignWorkspace.#view === "thread" && !selectedThread) {
      CampaignWorkspace.#view = "threads";
      CampaignWorkspace.#threadId = null;
    }
    CampaignWorkspace.#paintThreadEditor(panel, selectedThread);
    CampaignWorkspace.#applyView(panel);
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

        if (target.closest("[data-campaign-select-session]")) {
          CampaignWorkspace.#view = "session";
          CampaignWorkspace.#threadId = null;
          CampaignWorkspace.paint(root);
          return;
        }

        if (target.closest("[data-campaign-select-threads]")) {
          CampaignWorkspace.#view = "threads";
          CampaignWorkspace.#threadId = null;
          CampaignWorkspace.paint(root);
          return;
        }

        if (target.closest("[data-campaign-new-thread]")) {
          void CampaignWorkspace.#createThread(root);
          return;
        }

        const threadRow = target.closest("[data-campaign-thread-id]");
        if (threadRow) {
          const id = threadRow.getAttribute("data-campaign-thread-id");
          if (!id) return;
          CampaignWorkspace.#view = "thread";
          CampaignWorkspace.#threadId = id;
          CampaignWorkspace.paint(root);
          requestAnimationFrame(() => {
            const title = panel.querySelector("[data-campaign-thread-title]");
            if (title instanceof HTMLInputElement) title.focus();
          });
          return;
        }

        if (target.closest("[data-campaign-save-thread]")) {
          void CampaignWorkspace.#saveThread(root);
          return;
        }

        const beatRow = target.closest("[data-campaign-beat-index]");
        if (beatRow) {
          const index = Number(beatRow.getAttribute("data-campaign-beat-index"));
          if (!Number.isInteger(index)) return;
          void Promise.resolve(options.onOpenBeat?.(index));
        }
      },
      { signal: controller.signal }
    );

    RichTextToolbar.attach(panel);
    const notes = panel.querySelector("[data-campaign-thread-notes]");
    if (notes instanceof HTMLElement) {
      if (CampaignWorkspace.#mentionEditor && CampaignWorkspace.#mentionEditor !== notes) {
        EntityMentions.detach(CampaignWorkspace.#mentionEditor);
      }
      EntityMentions.attach(notes);
      CampaignWorkspace.#mentionEditor = notes;
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {ReturnType<typeof SessionService.getActive>} session
   */
  static #paintHeader(panel, session) {
    const current = panel.querySelector("[data-campaign-current-session]");
    if (current) current.textContent = session?.title?.trim() || "No active session";
  }

  /**
   * @param {HTMLElement} panel
   * @param {ReturnType<typeof SessionService.getActive>} session
   * @param {ReturnType<typeof ThreadService.list>} threads
   */
  static #paintSidebar(panel, session, threads) {
    const sessionButton = panel.querySelector("[data-campaign-select-session]");
    if (sessionButton) {
      sessionButton.textContent = session?.title?.trim() || "Session 1";
      sessionButton.classList.toggle("is-active", CampaignWorkspace.#view === "session");
    }

    const threadsButton = panel.querySelector("[data-campaign-select-threads]");
    threadsButton?.classList.toggle("is-active", CampaignWorkspace.#view === "threads");

    const list = panel.querySelector("[data-campaign-sidebar-threads]");
    if (!list) return;
    list.replaceChildren();

    for (const thread of threads) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-campaign-sidebar__item nd-campaign-sidebar__thread";
      button.dataset.campaignThreadId = thread.id;
      button.classList.toggle(
        "is-active",
        CampaignWorkspace.#view === "thread" && CampaignWorkspace.#threadId === thread.id
      );

      const title = document.createElement("span");
      title.textContent = thread.title?.trim() || "Untitled Thread";
      const status = document.createElement("span");
      status.className = "nd-campaign-status";
      status.dataset.status = thread.status;
      status.textContent = thread.status;
      button.append(title, status);
      list.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {ReturnType<typeof SessionService.getActive>} session
   */
  static #paintSession(panel, session) {
    const view = panel.querySelector("[data-campaign-view=\"session\"]");
    if (!(view instanceof HTMLElement)) return;

    const setText = (key, value, fallback = "—") => {
      const el = view.querySelector(`[data-campaign-session="${key}"]`);
      if (el) el.textContent = String(value || fallback);
    };

    setText("title", session?.title, "Session 1");
    setText("number", session?.sessionNumber, "1");
    setText("real-date", session?.realDate);
    setText("in-game-date", session?.inGameDate);
    setText("status", session?.status);
    const status = view.querySelector("[data-campaign-session=\"status\"]");
    if (status instanceof HTMLElement) status.dataset.status = session?.status ?? "planned";

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

    const beatList = view.querySelector("[data-campaign-session-beats]");
    if (!beatList) return;
    beatList.replaceChildren();

    const playbook = PlaybookService.getDocument();
    const beatsById = new Map(playbook.beats.map((beat, index) => [beat.id, { beat, index }]));
    const ownedBeats = (session?.beatIds ?? [])
      .map((id) => beatsById.get(id))
      .filter(Boolean);

    if (ownedBeats.length === 0) {
      const empty = document.createElement("p");
      empty.className = "nd-campaign-empty";
      empty.textContent = "No beats belong to this session.";
      beatList.append(empty);
      return;
    }

    for (const { beat, index } of ownedBeats) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-campaign-beat";
      button.dataset.campaignBeatIndex = String(index);

      const number = document.createElement("span");
      number.className = "nd-campaign-beat__number";
      number.textContent = String(index + 1);
      const title = document.createElement("span");
      title.textContent = beat.title?.trim() || "Untitled Beat";
      button.append(number, title);
      beatList.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {ReturnType<typeof ThreadService.list>} threads
   */
  static #paintThreadList(panel, threads) {
    const list = panel.querySelector("[data-campaign-thread-list]");
    const empty = panel.querySelector("[data-campaign-thread-empty]");
    if (!list || !empty) return;
    list.replaceChildren();
    empty.hidden = threads.length > 0;

    for (const thread of threads) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-campaign-thread-row";
      button.dataset.campaignThreadId = thread.id;

      const main = document.createElement("span");
      main.className = "nd-campaign-thread-row__main";
      const title = document.createElement("strong");
      title.textContent = thread.title?.trim() || "Untitled Thread";
      const type = document.createElement("span");
      type.textContent = thread.type?.trim() || "";
      type.hidden = !thread.type?.trim();
      main.append(title, type);

      const meta = document.createElement("span");
      meta.className = "nd-campaign-thread-row__meta";
      const status = document.createElement("span");
      status.className = "nd-campaign-status";
      status.dataset.status = thread.status;
      status.textContent = thread.status;
      const updated = document.createElement("time");
      updated.dateTime = new Date(thread.updated).toISOString();
      updated.textContent = CampaignWorkspace.#formatDate(thread.updated);
      meta.append(status, updated);

      button.append(main, meta);
      list.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {ReturnType<typeof ThreadService.getById>} thread
   */
  static #paintThreadEditor(panel, thread) {
    const editor = panel.querySelector("[data-campaign-thread-editor]");
    if (!(editor instanceof HTMLElement)) return;

    editor.dataset.threadId = thread?.id ?? "";
    const title = editor.querySelector("[data-campaign-thread-title]");
    const status = editor.querySelector("[data-campaign-thread-status]");
    const type = editor.querySelector("[data-campaign-thread-type]");
    const notes = editor.querySelector("[data-campaign-thread-notes]");
    const saved = editor.querySelector("[data-campaign-thread-saved]");

    if (title instanceof HTMLInputElement) title.value = thread?.title ?? "";
    if (status instanceof HTMLSelectElement) status.value = thread?.status ?? "OPEN";
    if (type instanceof HTMLInputElement) type.value = thread?.type ?? "";
    if (notes instanceof HTMLElement) notes.innerHTML = RichText.sanitize(thread?.notes ?? "");
    CampaignWorkspace.#paintReferences(editor, thread);
    if (saved) {
      saved.textContent = "";
      saved.hidden = true;
    }
  }

  /**
   * Render structured Thread references without edit controls.
   * @param {HTMLElement} editor
   * @param {ReturnType<typeof ThreadService.getById>} thread
   */
  static #paintReferences(editor, thread) {
    const playbook = PlaybookService.getDocument();
    const beatsById = new Map(playbook.beats.map((beat) => [beat.id, beat.title || "Untitled Beat"]));
    const groups = {
      beats: (thread?.relatedBeatIds ?? []).map((id) => ({
        id,
        name: beatsById.get(id) ?? id
      })),
      characters: (thread?.relatedCharacterIds ?? []).map((id) => ({
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      })),
      locations: (thread?.relatedLocationIds ?? []).map((id) => ({
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      })),
      items: (thread?.relatedItemIds ?? []).map((id) => ({
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      }))
    };

    for (const [key, references] of Object.entries(groups)) {
      const container = editor.querySelector(`[data-campaign-thread-refs="${key}"]`);
      if (!container) continue;
      container.replaceChildren();
      if (references.length === 0) {
        const empty = document.createElement("span");
        empty.className = "nd-campaign-reference-empty";
        empty.textContent = "No references";
        container.append(empty);
        continue;
      }
      for (const reference of references) {
        const chip = document.createElement("span");
        chip.className = "nd-campaign-reference";
        chip.title = reference.id;
        chip.textContent = reference.name;
        container.append(chip);
      }
    }
  }

  /**
   * @param {HTMLElement} panel
   */
  static #applyView(panel) {
    panel.querySelectorAll("[data-campaign-view]").forEach((view) => {
      view.hidden = view.getAttribute("data-campaign-view") !== CampaignWorkspace.#view;
    });
  }

  /**
   * @param {Element|null} element
   * @param {string|undefined} html
   * @param {string} emptyText
   */
  static #paintRichText(element, html, emptyText) {
    if (!(element instanceof HTMLElement)) return;
    const safe = RichText.sanitize(html ?? "");
    if (RichText.hasContent(safe)) {
      element.innerHTML = safe;
      element.classList.remove("nd-campaign-empty");
    } else {
      element.textContent = emptyText;
      element.classList.add("nd-campaign-empty");
    }
  }

  /**
   * @param {HTMLElement} root
   */
  static async #createThread(root) {
    const thread = await ThreadService.create({
      title: "Untitled Thread",
      status: "OPEN"
    });
    CampaignWorkspace.#view = "thread";
    CampaignWorkspace.#threadId = thread.id;
    CampaignWorkspace.paint(root);
    requestAnimationFrame(() => {
      const title = root.querySelector("[data-campaign-thread-title]");
      if (title instanceof HTMLInputElement) {
        title.focus();
        title.select();
      }
    });
  }

  /**
   * @param {HTMLElement} root
   */
  static async #saveThread(root) {
    const editor = root.querySelector("[data-campaign-thread-editor]");
    if (!(editor instanceof HTMLElement)) return;
    const id = editor.dataset.threadId;
    if (!id) return;

    const title = editor.querySelector("[data-campaign-thread-title]");
    const status = editor.querySelector("[data-campaign-thread-status]");
    const type = editor.querySelector("[data-campaign-thread-type]");
    const notes = editor.querySelector("[data-campaign-thread-notes]");

    const safeNotes = notes instanceof HTMLElement ? RichText.sanitize(notes.innerHTML) : "";
    const mentions = EntityMentions.extract(safeNotes);
    const idsFor = (kind, identity) =>
      mentions
        .filter((mention) => mention.kind === kind)
        .map((mention) => (identity === "uuid" ? mention.uuid : mention.id) || mention.id)
        .filter(Boolean);

    const updated = await ThreadService.update(id, {
      title: title instanceof HTMLInputElement ? title.value.trim() : "",
      status: status instanceof HTMLSelectElement ? status.value : "OPEN",
      type: type instanceof HTMLInputElement ? type.value.trim() : "",
      notes: safeNotes,
      relatedBeatIds: idsFor("beat", "id"),
      relatedCharacterIds: idsFor("actor", "uuid"),
      relatedLocationIds: idsFor("scene", "uuid"),
      relatedItemIds: idsFor("item", "uuid")
    });
    if (!updated) return;

    CampaignWorkspace.#threadId = updated.id;
    CampaignWorkspace.paint(root);
    const saved = root.querySelector("[data-campaign-thread-saved]");
    if (saved) {
      saved.textContent = "Saved";
      saved.hidden = false;
    }
  }

  /**
   * @param {number} timestamp
   * @returns {string}
   */
  static #formatDate(timestamp) {
    if (!Number.isFinite(timestamp)) return "—";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(timestamp));
  }
}
