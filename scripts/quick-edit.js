import {
  FACTION_REPUTATIONS,
  QUEST_ENTRY_STATUSES,
  STORY_THREAD_STATUSES
} from "./campaign-document.js";
import { CompanionStorage } from "./storage.js";
import { ContextEngine } from "./context-engine.js";
import { FactionService } from "./faction-service.js";
import { LiveNotes } from "./live-notes.js";
import { MentionProvider } from "./mention-provider.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { RichText } from "./rich-text.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * Inline Quick Updates — high-frequency campaign edits without opening editors.
 * Reuses existing entity models and service update paths (Activity + autosave).
 */
export class QuickEdit {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * Clickable status / reputation badge that cycles on click.
   * @param {string} value
   * @param {{
   *   kind: string,
   *   id: string,
   *   field?: "status"|"reputation",
   *   className?: string
   * }} options
   */
  static badge(value, options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.className ?? "nd-campaign-status nd-quick-cycle";
    button.dataset.quickCycle = options.field ?? "status";
    button.dataset.quickKind = options.kind;
    button.dataset.quickId = options.id;
    button.dataset.status = value;
    button.title = "Click to cycle";
    button.setAttribute("aria-label", `Cycle ${options.field ?? "status"}`);
    button.textContent = value;
    return button;
  }

  /**
   * Compact hover-revealed Quick Edit panel on an entity card.
   * @param {HTMLElement} host
   * @param {{
   *   kind: string,
   *   id: string,
   *   fields: Array<"currentState"|"currentStatus"|"status"|"reputation">
   * }} config
   */
  static mount(host, config) {
    if (!(host instanceof HTMLElement) || !config?.kind || !config?.id) return;
    host.classList.add("nd-quick-edit-host");
    const previous = host.querySelector(":scope > .nd-quick-edit");
    if (previous instanceof HTMLElement) {
      previous.querySelectorAll(".nd-quick-edit__editor").forEach((editor) => {
        if (editor instanceof HTMLElement) LiveNotes.detach(editor);
      });
      previous.remove();
    }

    const panel = document.createElement("div");
    panel.className = "nd-quick-edit";
    panel.dataset.quickEdit = "";
    panel.dataset.quickKind = config.kind;
    panel.dataset.quickId = config.id;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nd-quick-edit__toggle";
    toggle.dataset.quickEditToggle = "";
    toggle.textContent = "Quick Edit";
    toggle.setAttribute("aria-expanded", "false");
    panel.append(toggle);

    const body = document.createElement("div");
    body.className = "nd-quick-edit__body";
    body.hidden = true;
    body.dataset.quickEditBody = "";

    for (const field of config.fields ?? []) {
      body.append(QuickEdit.#fieldControl(config.kind, config.id, field));
    }
    panel.append(body);
    host.append(panel);
  }

  /**
   * @param {HTMLElement} root
   * @param {{ onRefresh?: () => void }} [options]
   */
  static attach(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    QuickEdit.#listeners.get(root)?.abort();
    const controller = new AbortController();
    QuickEdit.#listeners.set(root, controller);

    root.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const toggle = target.closest("[data-quick-edit-toggle]");
        if (toggle) {
          event.preventDefault();
          event.stopPropagation();
          QuickEdit.#togglePanel(toggle.closest("[data-quick-edit]"));
          return;
        }

        const cycle = target.closest("[data-quick-cycle]");
        if (cycle instanceof HTMLElement) {
          event.preventDefault();
          event.stopPropagation();
          void QuickEdit.#onCycle(cycle, options);
          return;
        }

        const addRel = target.closest("[data-quick-add-relationship]");
        if (addRel) {
          event.preventDefault();
          event.stopPropagation();
          void QuickEdit.#onAddRelationship(addRel.closest("[data-relationship-explorer]"), options);
        }
      },
      { signal: controller.signal }
    );

    root.addEventListener(
      "focusout",
      (event) => {
        const field = event.target;
        if (!(field instanceof HTMLElement)) return;
        if (!field.hasAttribute("data-quick-field")) return;
        const next = event.relatedTarget;
        if (next instanceof Node && field.contains(next)) return;
        void QuickEdit.#onFieldSave(field, options);
      },
      { signal: controller.signal }
    );
  }

  /**
   * Persist a relationship onto the owning entity (or the reverse side).
   * @param {{ kind: string, id: string }} owner
   * @param {{ kind: string, id: string }} related
   * @returns {Promise<boolean>}
   */
  static async addRelationship(owner, related) {
    if (!owner?.kind || !owner?.id || !related?.kind || !related?.id) return false;
    if (owner.kind === related.kind && owner.id === related.id) return false;

    const direct = QuickEdit.#relationshipPatch(owner.kind, related);
    if (direct) {
      return QuickEdit.#applyRelationshipPatch(owner.kind, owner.id, direct);
    }
    const reverse = QuickEdit.#relationshipPatch(related.kind, owner);
    if (reverse) {
      return QuickEdit.#applyRelationshipPatch(related.kind, related.id, reverse);
    }
    return false;
  }

  /**
   * Options for the Relationship Explorer entity picker.
   * @returns {{ value: string, label: string, kind: string, id: string }[]}
   */
  static pickerOptions() {
    const options = [];
    for (const group of MentionProvider.search("", 40)) {
      for (const entry of group.entries) {
        const kind = entry.kind === "scene"
          ? "location"
          : entry.kind === "beat"
            ? "questEntry"
            : entry.kind;
        if (kind === "session" || kind === "quest") continue;
        const id = entry.uuid || entry.id;
        if (!id) continue;
        options.push({
          value: `${kind}:${id}`,
          label: `${group.label}: ${entry.name}`,
          kind,
          id
        });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  static #togglePanel(panel) {
    if (!(panel instanceof HTMLElement)) return;
    const body = panel.querySelector("[data-quick-edit-body]");
    const toggle = panel.querySelector("[data-quick-edit-toggle]");
    if (!(body instanceof HTMLElement)) return;
    const open = body.hidden;
    body.hidden = !open;
    panel.classList.toggle("is-open", open);
    toggle?.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      const focusable = body.querySelector("[data-quick-field], [data-quick-cycle]");
      if (focusable instanceof HTMLElement) focusable.focus();
    }
  }

  static async #onCycle(badge, options) {
    const kind = badge.dataset.quickKind;
    const id = badge.dataset.quickId;
    const field = badge.dataset.quickCycle === "reputation" ? "reputation" : "status";
    if (!kind || !id) return;
    const next = QuickEdit.#nextValue(kind, field, badge.dataset.status ?? badge.textContent);
    if (!next) return;
    const ok = await QuickEdit.#applyCycle(kind, id, field, next);
    if (!ok) return;
    badge.dataset.status = next;
    badge.textContent = next;
    options.onRefresh?.();
  }

  static async #onFieldSave(field, options) {
    const kind = field.dataset.quickKind;
    const id = field.dataset.quickId;
    const name = field.dataset.quickField;
    if (!kind || !id || !name) return;
    const value = field.isContentEditable
      ? RichText.sanitize(field.innerHTML)
      : String(field.value ?? "");
    const ok = await QuickEdit.#applyField(kind, id, name, value);
    if (ok) options.onRefresh?.();
  }

  static async #onAddRelationship(explorer, options) {
    if (!(explorer instanceof HTMLElement)) return;
    const select = explorer.querySelector("[data-quick-relationship-select]");
    if (!(select instanceof HTMLSelectElement) || !select.value) return;
    const ownerKind = explorer.dataset.relationshipOwnerKind;
    const ownerId = explorer.dataset.relationshipOwnerId;
    if (!ownerKind || !ownerId) return;
    const [kind, ...rest] = select.value.split(":");
    const id = rest.join(":");
    if (!kind || !id) return;
    const ok = await QuickEdit.addRelationship(
      { kind: ownerKind, id: ownerId },
      { kind, id }
    );
    if (!ok) {
      ui.notifications?.warn("Could not add that relationship.");
      return;
    }
    select.value = "";
    options.onRefresh?.();
  }

  static #nextValue(kind, field, current) {
    const values = field === "reputation"
      ? FACTION_REPUTATIONS
      : kind === "storyThread"
        ? STORY_THREAD_STATUSES
        : kind === "questEntry"
          ? QUEST_ENTRY_STATUSES
          : null;
    if (!values?.length) return null;
    const index = values.indexOf(current);
    return values[(index + 1) % values.length];
  }

  static async #refreshPlayIfLoaded(id) {
    if (!PlaybookService.isLoaded(id)) return;
    const { Playbook } = await import("./playbook.js");
    Playbook.refreshOpen();
  }

  static async #applyCycle(kind, id, field, next) {
    if (kind === "storyThread" && field === "status") {
      return Boolean(await StoryThreadService.update(id, { status: next }));
    }
    if (kind === "questEntry" && field === "status") {
      const updated = await QuestEntryService.update(id, { status: next });
      if (updated) await QuickEdit.#refreshPlayIfLoaded(id);
      return Boolean(updated);
    }
    if (kind === "faction" && field === "reputation") {
      return Boolean(await FactionService.update(id, { playerReputation: next }));
    }
    return false;
  }

  static async #applyField(kind, id, field, value) {
    if (kind === "storyThread" && field === "currentState") {
      return Boolean(await StoryThreadService.update(id, { currentState: value }));
    }
    if (kind === "faction" && field === "currentStatus") {
      return Boolean(await FactionService.update(id, { currentStatus: value }));
    }
    if (field === "currentStatus" && ["actor", "location", "item", "questEntry"].includes(kind)) {
      const key = ContextEngine.currentStatusKey({ kind, id });
      if (!key) return false;
      await CompanionStorage.setMemory(key, value);
      return true;
    }
    return false;
  }

  static #fieldControl(kind, id, field) {
    const wrap = document.createElement("label");
    wrap.className = "nd-quick-edit__field";

    if (field === "status" || field === "reputation") {
      const label = document.createElement("span");
      label.textContent = field === "reputation" ? "Reputation" : "Status";
      const current = QuickEdit.#currentCycleValue(kind, id, field);
      wrap.append(label, QuickEdit.badge(current, { kind, id, field }));
      return wrap;
    }

    const label = document.createElement("span");
    label.textContent = field === "currentState" ? "Current State" : "Current Status";
    const editor = document.createElement("div");
    editor.className = "nd-quick-edit__editor nd-richtext nd-richtext--editor";
    editor.contentEditable = "true";
    editor.dataset.placeholder = field === "currentState"
      ? "What is true right now?"
      : "Current status...";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", label.textContent);

    if (field === "currentState" && kind === "storyThread") {
      editor.dataset.quickField = field;
      editor.dataset.quickKind = kind;
      editor.dataset.quickId = id;
      editor.innerHTML = RichText.sanitize(
        StoryThreadService.getById(id)?.currentState ?? ""
      );
    } else if (field === "currentStatus" && kind === "faction") {
      editor.dataset.quickField = field;
      editor.dataset.quickKind = kind;
      editor.dataset.quickId = id;
      editor.innerHTML = RichText.sanitize(
        FactionService.getById(id)?.currentStatus ?? ""
      );
    } else if (field === "currentStatus") {
      const key = ContextEngine.currentStatusKey({ kind, id });
      editor.innerHTML = RichText.sanitize(key ? CompanionStorage.getMemory(key) : "");
      if (key) {
        LiveNotes.attach(editor, key, {
          memory: true,
          html: true,
          sanitize: RichText.sanitize
        });
      }
    }

    wrap.append(label, editor);
    return wrap;
  }

  static #currentCycleValue(kind, id, field) {
    if (kind === "storyThread") {
      return StoryThreadService.getById(id)?.status ?? "ACTIVE";
    }
    if (kind === "questEntry") {
      return QuestEntryService.getById(id)?.status ?? "PLANNED";
    }
    if (kind === "faction" && field === "reputation") {
      return FactionService.getById(id)?.playerReputation ?? "NEUTRAL";
    }
    return "";
  }

  /**
   * @param {string} ownerKind
   * @param {{ kind: string, id: string }} related
   * @returns {Record<string, string[]>|null}
   */
  static #relationshipPatch(ownerKind, related) {
    const relatedKind = related.kind === "scene" ? "location" : related.kind;
    const id = related.id;
    if (ownerKind === "storyThread") {
      if (relatedKind === "actor") return { relatedActorIds: [id] };
      if (relatedKind === "location") return { relatedLocationIds: [id] };
      if (relatedKind === "item") return { relatedItemIds: [id] };
      if (relatedKind === "quest" || relatedKind === "questEntry") {
        return relatedKind === "quest" ? { relatedQuestIds: [id] } : null;
      }
      if (relatedKind === "session") return { relatedSessionIds: [id] };
    }
    if (ownerKind === "questEntry") {
      if (relatedKind === "actor") return { relatedCharacterIds: [id] };
      if (relatedKind === "location") return { relatedLocationIds: [id] };
      if (relatedKind === "item") return { relatedItemIds: [id] };
      if (relatedKind === "questEntry") return { relatedBeatIds: [id] };
    }
    if (ownerKind === "faction") {
      if (relatedKind === "actor") return { relatedActorIds: [id] };
      if (relatedKind === "storyThread") return { relatedStoryThreadIds: [id] };
      if (relatedKind === "location") return { relatedLocationIds: [id] };
      if (relatedKind === "item") return { relatedItemIds: [id] };
      if (relatedKind === "quest") return { relatedQuestIds: [id] };
      if (relatedKind === "faction") return { relatedFactionIds: [id] };
      if (relatedKind === "session") return { relatedSessionIds: [id] };
    }
    return null;
  }

  static async #applyRelationshipPatch(kind, id, patch) {
    const merge = (existing, additions) => [
      ...new Set([...(existing ?? []), ...(additions ?? [])].filter(Boolean))
    ];

    if (kind === "storyThread") {
      const thread = StoryThreadService.getById(id);
      if (!thread) return false;
      const next = {};
      for (const [key, values] of Object.entries(patch)) {
        next[key] = merge(thread[key], values);
      }
      return Boolean(await StoryThreadService.update(id, next));
    }
    if (kind === "questEntry") {
      const entry = QuestEntryService.getById(id);
      if (!entry) return false;
      const next = {};
      for (const [key, values] of Object.entries(patch)) {
        next[key] = merge(entry[key], values);
      }
      const updated = await QuestEntryService.update(id, next);
      if (updated) await QuickEdit.#refreshPlayIfLoaded(id);
      return Boolean(updated);
    }
    if (kind === "faction") {
      const faction = FactionService.getById(id);
      if (!faction) return false;
      const next = {};
      for (const [key, values] of Object.entries(patch)) {
        next[key] = merge(faction[key], values);
      }
      return Boolean(await FactionService.update(id, next));
    }
    return false;
  }
}
