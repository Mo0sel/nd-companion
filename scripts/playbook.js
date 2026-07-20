import { EntityRegistry } from "./entity-registry.js";
import { LiveNotes } from "./live-notes.js";
import { Navigation } from "./navigation.js";
import { PlaybookEntities } from "./playbook-entities.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { QuickEdit } from "./quick-edit.js";
import { RelationshipService } from "./relationship-service.js";
import { RichText } from "./rich-text.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * @typedef {import("./playbook-service.js").PlaybookBeat} PlaybookBeat
 */

/**
 * Display-only beat status derived from position vs currentIndex.
 * Not persisted — previous → done, current → active, future → planned.
 * @typedef {"planned"|"active"|"done"} DerivedBeatStatus
 */

/**
 * Play workspace Playbook viewer. Data comes only from PlaybookService.
 */
export class Playbook {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {number} index
   * @param {number} currentIndex
   * @returns {DerivedBeatStatus}
   */
  static #derivedStatus(index, currentIndex) {
    if (index < currentIndex) return "done";
    if (index === currentIndex) return "active";
    return "planned";
  }

  /**
   * Completion is derived from the current Entry's objective checklist.
   * This keeps PLAY status lightweight and avoids another persistence field.
   * @param {PlaybookBeat} beat
   * @returns {"active"|"done"}
   */
  static #currentStatus(beat) {
    const template = document.createElement("template");
    template.innerHTML = Playbook.#objectiveHtml(beat?.objective ?? "");
    const objectives = [...template.content.querySelectorAll("p, li")];
    return objectives.length > 0 &&
      objectives.every((objective) => objective.classList.contains("nd-objective-complete"))
      ? "done"
      : "active";
  }

  /**
   * Legacy single-line objectives become one checklist row without migration.
   * @param {string} value
   * @returns {string}
   */
  static #objectiveHtml(value) {
    const safe = RichText.sanitize(value ?? "");
    if (!RichText.hasContent(safe)) return safe;
    const container = document.createElement("div");
    container.innerHTML = safe;
    if (!container.querySelector("p, li")) {
      const row = document.createElement("p");
      row.append(...container.childNodes);
      container.append(row);
    }
    return container.innerHTML;
  }

  /**
   * @returns {{
   *   index: number,
   *   total: number,
   *   canPrev: boolean,
   *   canNext: boolean,
   *   beat: PlaybookBeat,
   *   nextBeat: PlaybookBeat|null,
   *   status: DerivedBeatStatus
   * }}
   */
  static get() {
    const current = PlaybookService.getCurrent();
    const nextBeat =
      current.index < current.total - 1 ? PlaybookService.getBeat(current.index + 1) : null;
    return {
      index: current.index,
      total: current.total,
      canPrev: current.canPrevious,
      canNext: current.canNext,
      beat: current.beat,
      nextBeat,
      status: current.total > 0 ? Playbook.#currentStatus(current.beat) : "active"
    };
  }

  static async prev() {
    const moved = await PlaybookService.previous();
    if (moved) Playbook.refreshOpen();
  }

  static async next() {
    const moved = await PlaybookService.next();
    if (moved) Playbook.refreshOpen();
  }

  static refreshOpen() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!app?.element) return;
    Playbook.paint(app.element, Playbook.get());
  }

  /**
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static paint(root, snapshot) {
    if (!(root instanceof HTMLElement) || !snapshot) return;

    const panel = root.querySelector("[data-playbook]");
    if (!panel) return;

    const setText = (key, value) => {
      const el = panel.querySelector(`[data-playbook="${key}"]`);
      if (el) el.textContent = value ?? "";
    };

    const setCounter = (current, total) => {
      const currentEl = panel.querySelector("[data-playbook-counter=\"current\"]");
      const totalEl = panel.querySelector("[data-playbook-counter=\"total\"]");
      if (currentEl) currentEl.textContent = String(current);
      if (totalEl) totalEl.textContent = String(total);
    };

    const setTextField = (key, value, { alwaysVisible = false } = {}) => {
      const field = panel.querySelector(`[data-playbook-field-block="${key}"]`);
      const renderer = panel.querySelector(`[data-playbook="${key}"]`);
      const safeHtml = key === "objective"
        ? Playbook.#objectiveHtml(value ?? "")
        : RichText.sanitize(value ?? "");
      const hasContent = RichText.hasContent(safeHtml);
      if (field) field.hidden = !alwaysVisible && !hasContent;
      if (renderer) renderer.innerHTML = safeHtml;
    };

    const status = snapshot.status;
    panel.dataset.beatStatus = status;
    const accent = panel.querySelector("[data-playbook=\"accent\"]");
    if (accent) accent.dataset.status = status;

    const empty = panel.querySelector("[data-play-empty]");
    const content = panel.querySelector("[data-play-content]");
    const entryNav = panel.querySelector(".nd-play-entry-nav");
    const hasQuest = snapshot.total > 0;

    if (empty instanceof HTMLElement) empty.hidden = hasQuest;
    if (content instanceof HTMLElement) {
      content.classList.toggle("is-empty", !hasQuest);
    }
    if (entryNav instanceof HTMLElement) {
      entryNav.hidden = !hasQuest;
    }
    panel.querySelectorAll(
      ".nd-play-section-title, .nd-play-entry-grid, [data-playbook-field-block=\"npcs\"]"
    ).forEach((el) => {
      if (el instanceof HTMLElement) el.hidden = !hasQuest;
    });

    if (!hasQuest) {
      setCounter(0, 0);
      setText("title", "No Quest Loaded");
      for (const field of [
        "speechNotes",
        "setup",
        "objective",
        "experience",
        "twist",
        "possibleOutcomes",
        "gmNotes"
      ]) {
        setTextField(field, "");
      }
      Playbook.#paintEntities(panel, null);
    } else {
      setCounter(snapshot.index + 1, snapshot.total);
      setText("title", snapshot.beat.title?.trim() || "Untitled Quest");
      for (const field of [
        "speechNotes",
        "setup",
        "objective",
        "experience",
        "twist",
        "possibleOutcomes",
        "gmNotes"
      ]) {
        setTextField(field, snapshot.beat[field], { alwaysVisible: true });
      }
      Playbook.#paintEntities(panel, snapshot.beat);
    }

    Playbook.#paintStatus(panel, hasQuest ? status : "idle");
    Playbook.#paintRunControls(root);

    const prevBtn = panel.querySelector("[data-playbook-nav=\"prev\"]");
    const nextBtn = panel.querySelector("[data-playbook-nav=\"next\"]");
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = !snapshot.canPrev;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = !snapshot.canNext;

    Playbook.#attachInlineEditors(root, snapshot);
    Playbook.#paintSessionNpcs(root, snapshot);
    Playbook.#paintStoryThreads(root);
  }

  static #paintStoryThreads(root) {
    const card = root.querySelector("[data-play-story-threads]");
    const list = root.querySelector("[data-play-story-thread-list]");
    const count = root.querySelector("[data-play-story-thread-count]");
    if (!(card instanceof HTMLElement) || !(list instanceof HTMLElement)) return;
    const threads = StoryThreadService.list()
      .filter((thread) => thread.status === "ACTIVE")
      .sort((a, b) => a.title.localeCompare(b.title));
    card.hidden = threads.length === 0;
    list.replaceChildren();
    if (count) count.textContent = String(threads.length);
    for (const thread of threads) {
      const quests = QuestEntryService.listForStoryThread(thread.id);
      const actorIds = Playbook.#storyThreadActorIds(thread);
      const actors = actorIds
        .map((id) => EntityRegistry.findByUUID(id))
        .filter(Boolean)
        .slice(0, 3);

      const threadCard = document.createElement("article");
      threadCard.className = "nd-play-story-thread";
      threadCard.dataset.playStoryThreadId = thread.id;

      const open = document.createElement("button");
      open.type = "button";
      open.className = "nd-play-story-thread__open";
      open.dataset.playStoryThreadId = thread.id;

      const head = document.createElement("div");
      head.className = "nd-play-story-thread__head";
      const title = document.createElement("strong");
      title.className = "nd-play-story-thread__title";
      title.textContent = thread.title?.trim() || "Untitled Story Thread";
      const active = document.createElement("span");
      active.className = "nd-play-story-thread__active";
      active.textContent = "Active";
      head.append(title, active);

      const state = document.createElement("p");
      state.className = "nd-play-story-thread__state";
      state.textContent = RichText.plainText(thread.currentState ?? "") || "No current state set.";

      const meta = document.createElement("div");
      meta.className = "nd-play-story-thread__meta";

      const actorRow = document.createElement("div");
      actorRow.className = "nd-play-story-thread__actors";
      if (actors.length) {
        for (const actor of actors) {
          const chip = document.createElement("span");
          chip.className = "nd-play-story-thread__actor";
          chip.textContent = Playbook.#shortActorName(actor.name);
          actorRow.append(chip);
        }
        const extra = actorIds.length - actors.length;
        if (extra > 0) {
          const more = document.createElement("span");
          more.className = "nd-play-story-thread__actor-more";
          more.textContent = `+${extra}`;
          actorRow.append(more);
        }
      } else {
        const empty = document.createElement("span");
        empty.className = "nd-play-story-thread__actors-empty";
        empty.textContent = "No linked actors";
        actorRow.append(empty);
      }
      meta.append(actorRow);

      const questCount = document.createElement("span");
      questCount.className = "nd-play-story-thread__quests";
      questCount.textContent = quests.length === 1
        ? "1 Quest"
        : `${quests.length} Quests`;
      meta.append(questCount);

      open.append(head, state, meta);
      threadCard.append(open);
      QuickEdit.mount(threadCard, {
        kind: "storyThread",
        id: thread.id,
        fields: ["status", "currentState"],
        placement: "menu"
      });
      list.append(threadCard);
    }
  }

  /**
   * @param {object} thread
   * @returns {string[]}
   */
  static #storyThreadActorIds(thread) {
    const ids = new Set(
      (thread.relatedActorIds ?? []).filter(Boolean)
    );
    for (const neighbor of RelationshipService.neighbors({
      kind: "storyThread",
      id: thread.id
    })) {
      if (neighbor.kind === "actor" && neighbor.id) ids.add(neighbor.id);
    }
    return [...ids];
  }

  /** @param {string} [name] */
  static #shortActorName(name) {
    const text = String(name ?? "").trim();
    if (!text) return "Actor";
    return text.split(/\s+/)[0];
  }

  static #paintRunControls(root) {
    const campaign = root.querySelector("[data-play-campaign-select]");
    const session = root.querySelector("[data-play-session-select]");
    const beat = root.querySelector("[data-play-beat-select]");
    if (campaign instanceof HTMLSelectElement) {
      campaign.replaceChildren(new Option(game.world?.title?.trim() || "Campaign", ""));
    }
    if (session instanceof HTMLSelectElement) {
      const activeId = SessionService.getActive()?.id ?? "";
      const sessions = SessionService.list()
        .filter((entry) => entry.status !== "completed")
        .sort((a, b) => a.sessionNumber - b.sessionNumber);
      session.replaceChildren();
      for (const entry of sessions) {
        const label = entry.title?.trim()
          ? `Session ${entry.sessionNumber} · ${entry.title.trim()}`
          : `Session ${entry.sessionNumber}`;
        session.add(new Option(label, entry.id, false, entry.id === activeId));
      }
      session.disabled = sessions.length <= 1;
    }
    if (beat instanceof HTMLSelectElement) {
      const current = PlaybookService.getIndex();
      const beats = PlaybookService.listBeats();
      beat.replaceChildren();
      for (const entry of beats) {
        beat.add(new Option(
          `${entry.index + 1}. ${entry.title}`,
          String(entry.index),
          false,
          entry.index === current
        ));
      }
      beat.disabled = beats.length === 0;
    }
  }

  /**
   * @param {Element} panel
   * @param {"active"|"done"|"idle"} status
   */
  static #paintStatus(panel, status) {
    const state = panel.querySelector("[data-playbook-state]");
    const value = panel.querySelector("[data-playbook-state-value]");
    const accent = panel.querySelector("[data-playbook=\"accent\"]");
    if (state instanceof HTMLElement) state.dataset.state = status;
    if (accent instanceof HTMLElement) accent.dataset.status = status;
    if (value) {
      value.textContent = status === "done"
        ? "Completed"
        : status === "active"
          ? "Active"
          : "No Quest Loaded";
    }
  }

  /**
   * Read-only expandable overview of everything PREPARE assembled.
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #paintSessionPlan(root, snapshot) {
    const list = root.querySelector("[data-play-session-plan]");
    const count = root.querySelector("[data-play-session-count]");
    if (!list) return;
    list.replaceChildren();
    const playbookDoc = PlaybookService.getDocument();
    if (count) count.textContent = `${playbookDoc.beats.length} ${playbookDoc.beats.length === 1 ? "entry" : "entries"}`;

    if (!playbookDoc.beats.length) {
      const empty = document.createElement("p");
      empty.className = "nd-campaign-empty";
      empty.textContent = "No Quest Loaded. Select a Quest from the Campaign Explorer.";
      list.append(empty);
      return;
    }

    playbookDoc.beats.forEach((beat, index) => {
      const details = document.createElement("details");
      details.className = "nd-play-session-entry";
      details.open = index === snapshot.index;
      const summary = document.createElement("summary");
      const status = document.createElement("span");
      status.className = "nd-play-session-entry__status";
      status.dataset.status = Playbook.#derivedStatus(index, snapshot.index);
      status.textContent = status.dataset.status === "done"
        ? "COMPLETED"
        : status.dataset.status.toUpperCase();
      const title = document.createElement("strong");
      title.textContent = beat.title?.trim() || "Untitled Entry";
      summary.append(status, title);

      const body = document.createElement("div");
      body.className = "nd-play-session-entry__body";
      const fields = [
        ["Speech Notes", beat.speechNotes],
        ["Objective", beat.objective],
        ["Setup", beat.setup],
        ["Twist", beat.twist],
        ["Possible Outcomes", beat.possibleOutcomes],
        ["Reward", beat.experience],
        ["Notes", beat.gmNotes]
      ];
      for (const [label, value] of fields) {
        const safe = RichText.sanitize(value ?? "");
        if (!RichText.hasContent(safe)) continue;
        const section = document.createElement("section");
        const heading = document.createElement("h4");
        heading.textContent = label;
        const content = document.createElement("div");
        content.className = "nd-richtext";
        content.innerHTML = safe;
        section.append(heading, content);
        body.append(section);
      }
      const referenceIds = [
        ...(beat.relatedBeatIds ?? []).map((id) => QuestEntryService.getById(id)?.title ?? id),
        ...(beat.relatedCharacterIds ?? []).map((id) => EntityRegistry.findByUUID(id)?.name ?? id),
        ...(beat.relatedLocationIds ?? []).map((id) => EntityRegistry.findByUUID(id)?.name ?? id),
        ...(beat.relatedItemIds ?? []).map((id) => EntityRegistry.findByUUID(id)?.name ?? id)
      ];
      if (referenceIds.length) {
        const section = document.createElement("section");
        const heading = document.createElement("h4");
        heading.textContent = "References";
        const references = document.createElement("div");
        references.className = "nd-play-session-entry__references";
        for (const name of referenceIds) {
          const chip = document.createElement("span");
          chip.textContent = name;
          references.append(chip);
        }
        section.append(heading, references);
        body.append(section);
      }
      details.append(summary, body);
      list.append(details);
    });
  }

  /**
   * Objective and Experience are deliberately editable in PLAY.
   * LiveNotes supplies the existing debounce/autosave behavior while
   * PlaybookService remains the only persistence path.
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #attachInlineEditors(root, snapshot) {
    const editableFields = ["speechNotes", "objective", "experience", "gmNotes"];
    const editors = editableFields
      .map((field) => root.querySelector(`[data-playbook="${field}"]`))
      .filter((element) => element instanceof HTMLElement);

    if (snapshot.total <= 0) {
      for (const editor of editors) LiveNotes.detach(editor);
      return;
    }

    for (const field of editableFields) {
      const editor = root.querySelector(`[data-playbook="${field}"]`);
      if (!(editor instanceof HTMLElement)) continue;
      LiveNotes.attach(editor, null, {
        html: true,
        sanitize: RichText.sanitize,
        load: () =>
          field === "objective"
            ? Playbook.#objectiveHtml(snapshot.beat[field] ?? "")
            : snapshot.beat[field] ?? "",
        save: async (value) => {
          await PlaybookService.updateBeat(snapshot.index, { [field]: value });
        }
      });
    }
  }

  /**
   * @param {HTMLElement} panel
   * @param {PlaybookBeat|null} beat
   */
  static #paintEntities(panel, beat) {
    const field = panel.querySelector("[data-playbook-field-block=\"entities\"]");
    const container = panel.querySelector("[data-playbook=\"entities\"]");
    if (!field || !container) return;

    const uuids = beat
      ? [
          ...(beat.sceneUuid ? [beat.sceneUuid] : []),
          ...(beat.keyNpcUuids ?? []),
          ...(beat.relatedCharacterIds ?? []),
          ...(beat.relatedLocationIds ?? []),
          ...(beat.relatedItemIds ?? [])
        ]
      : [];
    PlaybookEntities.paintChips(container, uuids);
    for (const id of beat?.relatedBeatIds ?? []) {
      const reference = QuestEntryService.getById(id);
      if (!reference) continue;
      const chip = document.createElement("span");
      chip.className = "nd-chip";
      chip.textContent = reference.title?.trim() || "Untitled Entry";
      container.append(chip);
    }
    field.hidden = false;
  }

  /**
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #paintBeatFocus(root, snapshot) {
    const focus = root.querySelector("[data-beat-focus]");
    if (!focus) return;

    const set = (key, value, { hideEmpty = false } = {}) => {
      const el = focus.querySelector(`[data-beat-focus="${key}"]`);
      if (!el) return;
      const text = value?.trim?.() ? value.trim() : value || "";
      el.textContent = text || (key.endsWith("title") ? "—" : "");
      if (hideEmpty) el.hidden = !text;
    };

    if (snapshot.total <= 0) {
      set("now-title", "—");
      set("now-objective", "", { hideEmpty: true });
      set("next-title", "—");
      set("next-objective", "", { hideEmpty: true });
    } else {
      set("now-title", snapshot.beat.title?.trim() || "Untitled Entry");
      set("now-objective", RichText.plainText(snapshot.beat.objective), { hideEmpty: true });
      set("next-title", snapshot.nextBeat?.title?.trim() || "—");
      set(
        "next-objective",
        snapshot.nextBeat ? RichText.plainText(snapshot.nextBeat.objective) : "",
        { hideEmpty: true }
      );
    }
  }

  /**
   * Session NPCs from the current beat's characters (EntityRegistry).
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #paintSessionNpcs(root, snapshot) {
    const list = root.querySelector("[data-play-npcs]");
    const empty = root.querySelector("[data-play-npcs-empty]");
    if (!list) return;

    list.replaceChildren();
    const uuids = snapshot.total > 0 ? snapshot.beat.keyNpcUuids ?? [] : [];
    const chips = PlaybookEntities.resolveChips(uuids);

    if (empty) empty.hidden = chips.length > 0;

    for (const chip of chips) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "nd-play-npc";
      if (chip.navigable && !chip.missing) {
        row.classList.add("nd-play-npc--navigable");
        row.dataset.playbookEntity = chip.uuid;
        row.title = `Open ${chip.name} in Foundry`;
      } else {
        row.disabled = true;
        row.title = chip.missing ? "Not found in this world" : "Cannot navigate";
      }

      const avatar = document.createElement("span");
      avatar.className = "nd-play-npc__avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = Playbook.#initials(chip.name);
      avatar.style.setProperty("--nd-npc-avatar", Playbook.#avatarColor(chip.name));

      const meta = document.createElement("span");
      meta.className = "nd-play-npc__meta";

      const name = document.createElement("span");
      name.className = "nd-play-npc__name";
      name.textContent = chip.name;

      if (chip.context) {
        const role = document.createElement("span");
        role.className = "nd-play-npc__role";
        role.textContent = chip.context;
        name.append(role);
      }

      meta.append(name);
      row.append(avatar, meta);
      list.append(row);
    }
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static #initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static #avatarColor(name) {
    const palette = ["#3d5a8a", "#3d6b5a", "#6b4a7a", "#7a5a3d", "#3d6b7a", "#7a3d4a"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  /**
   * @param {HTMLElement} root
   * @param {{
   *   onEndSession?: () => Promise<void>|void,
   *   onOpenStoryThread?: (id: string) => Promise<void>|void,
   *   onOpenFaction?: (id: string) => Promise<void>|void,
   *   onSelectSession?: (id: string) => Promise<void>|void
   * }} [options]
   */
  static attach(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-playbook]");
    if (!panel) return;

    const previous = Playbook.#listeners.get(panel);
    previous?.abort();

    const controller = new AbortController();
    Playbook.#listeners.set(panel, controller);

    const playRoot = root.querySelector("[data-workspace-panel=\"play\"]") ?? panel;

    playRoot.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest(".nd-quick-edit-menu")) return;

        const nav = target.closest("[data-playbook-nav]");
        if (nav) {
          const direction = nav.getAttribute("data-playbook-nav");
          if (direction === "prev") void Playbook.prev();
          else if (direction === "next") void Playbook.next();
          return;
        }

        if (target.closest("[data-end-session]")) {
          void Promise.resolve(options.onEndSession?.());
          return;
        }

        const storyThread = target.closest(".nd-play-story-thread__open[data-play-story-thread-id]");
        if (storyThread) {
          const id = storyThread.getAttribute("data-play-story-thread-id");
          if (id) void Promise.resolve(options.onOpenStoryThread?.(id));
          return;
        }

        const addObjective = target.closest("[data-objective-add]");
        if (addObjective) {
          const editor = panel.querySelector("[data-playbook=\"objective\"]");
          if (!(editor instanceof HTMLElement)) return;
          const objective = document.createElement("p");
          objective.textContent = "New objective";
          editor.append(objective);
          editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
          const range = document.createRange();
          range.selectNodeContents(objective);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          editor.focus();
          return;
        }

        const objectiveEditor = panel.querySelector("[data-playbook=\"objective\"]");
        const objectiveLine = target.closest("p, li");
        if (
          objectiveEditor instanceof HTMLElement &&
          objectiveLine instanceof HTMLElement &&
          objectiveEditor.contains(objectiveLine)
        ) {
          const bounds = objectiveLine.getBoundingClientRect();
          if (event.clientX <= bounds.left + 22) {
            event.preventDefault();
            objectiveLine.classList.toggle("nd-objective-complete");
            objectiveEditor.dispatchEvent(
              new InputEvent("input", { bubbles: true, inputType: "formatSetBlockTextDirection" })
            );
            const status = Playbook.#currentStatus({
              ...Playbook.get().beat,
              objective: objectiveEditor.innerHTML
            });
            Playbook.#paintStatus(panel, status);
            return;
          }
        }

        const chip = target.closest("[data-playbook-entity]");
        if (!chip) return;
        const uuid = chip.getAttribute("data-playbook-entity");
        if (!uuid) return;

        const entity = EntityRegistry.findByUUID(uuid);
        if (!entity || !Navigation.canNavigate(entity)) return;
        void Navigation.navigate(entity);
      },
      { signal: controller.signal }
    );
    playRoot.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.matches("[data-play-beat-select]")) {
          const index = Number(target.value);
          if (!Number.isInteger(index)) return;
          void PlaybookService.setCurrentIndex(index).then((moved) => {
            if (moved) Playbook.paint(root, Playbook.get());
          });
          return;
        }
        if (target.matches("[data-play-session-select]") && target.value) {
          void Promise.resolve(options.onSelectSession?.(target.value));
        }
      },
      { signal: controller.signal }
    );
  }
}
