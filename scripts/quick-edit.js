import {
  FACTION_REPUTATIONS,
  QUEST_ENTRY_STATUSES,
  STORY_THREAD_STATUSES
} from "./campaign-document.js";
import { CompanionStorage } from "./storage.js";
import { ContextEngine } from "./context-engine.js";
import { EntityLinkService } from "./entity-link-service.js";
import { RelationshipService } from "./relationship-service.js";
import { FactionService } from "./faction-service.js";
import { LiveNotes } from "./live-notes.js";
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
   * Prefer {@link QuickEdit.statusDot} in dense lists.
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
   * Compact circular status indicator (Explorer / dense lists).
   * @param {string} value
   * @param {{
   *   kind: string,
   *   id: string,
   *   field?: "status",
   *   className?: string
   * }} options
   */
  static statusDot(value, options) {
    const status = String(value || "").trim() || (
      options.kind === "questEntry" ? "PLANNED" : "ACTIVE"
    );
    const meta = QuickEdit.#statusDotMeta(options.kind, status);
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.className ?? "nd-status-dot nd-quick-cycle";
    button.dataset.quickCycle = options.field ?? "status";
    button.dataset.quickKind = options.kind;
    button.dataset.quickId = options.id;
    button.dataset.status = status;
    button.textContent = meta.letter;
    button.title = meta.label;
    button.setAttribute("aria-label", `${meta.label}. Click to cycle status.`);
    return button;
  }

  /**
   * Removed in Sprint 40.2 — floating Quick Edit blocked list navigation.
   * Editing happens by opening the entity.
   * @param {HTMLElement} _host
   * @param {object} [_config]
   */
  static mount(_host, _config) {
    // Intentionally empty.
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

        if (target.closest(".nd-quick-edit-menu")) {
          event.stopPropagation();
        }

        const cycle = target.closest("[data-quick-cycle]");
        if (cycle instanceof HTMLElement) {
          event.preventDefault();
          event.stopPropagation();
          void QuickEdit.#onCycle(cycle, options);
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
   * Persist a relationship as a first-class graph edge (single store).
   * Mirrors onto document related* fields when available for export/mentions.
   * Never throws — returns false on failure.
   * @param {{ kind: string, id: string }} owner
   * @param {{ kind: string, id: string }} related
   * @returns {Promise<boolean>}
   */
  static async addRelationship(owner, related) {
    try {
      if (!owner?.kind || !owner?.id || !related?.kind || !related?.id) return false;
      const left = QuickEdit.#normalizeRef(owner);
      const right = QuickEdit.#normalizeRef(related);
      if (!left || !right) return false;
      if (left.kind === right.kind && left.id === right.id) return false;

      const relationship = await RelationshipService.connect(left, right);
      if (!relationship && !RelationshipService.has(left, right)) return false;

      // Best-effort document mirror (does not create a second graph edge).
      const direct = QuickEdit.#relationshipPatch(left.kind, right);
      if (direct) {
        await QuickEdit.#applyRelationshipPatch(left.kind, left.id, direct);
      } else {
        const reverse = QuickEdit.#relationshipPatch(right.kind, left);
        if (reverse) {
          await QuickEdit.#applyRelationshipPatch(right.kind, right.id, reverse);
        }
      }
      return true;
    } catch (error) {
      console.error("N&D Companion: addRelationship failed", error);
      return false;
    }
  }

  /**
   * @param {{ kind: string, id: string }} owner
   * @param {{ kind: string, id: string }} related
   */
  static canRemoveRelationship(owner, related) {
    try {
      const left = QuickEdit.#normalizeRef(owner);
      const right = QuickEdit.#normalizeRef(related);
      if (!left || !right) return false;
      if (RelationshipService.has(left, right)) return true;
      return Boolean(
        QuickEdit.#relationshipField(left.kind, right.kind) ||
        QuickEdit.#relationshipField(right.kind, left.kind) ||
        EntityLinkService.has(left, right)
      );
    } catch (error) {
      console.error("N&D Companion: canRemoveRelationship failed", error);
      return false;
    }
  }

  /**
   * @param {{ kind: string, id: string }} owner
   * @param {{ kind: string, id: string }} related
   * @returns {Promise<boolean>}
   */
  static async removeRelationship(owner, related) {
    try {
      if (!QuickEdit.canRemoveRelationship(owner, related)) return false;
      const left = QuickEdit.#normalizeRef(owner);
      const right = QuickEdit.#normalizeRef(related);
      if (!left || !right) return false;

      let removed = await RelationshipService.disconnect(left, right);

      const directField = QuickEdit.#relationshipField(left.kind, right.kind);
      if (directField) {
        removed = (await QuickEdit.#removeFromField(left.kind, left.id, directField, right.id)) || removed;
      }
      const reverseField = QuickEdit.#relationshipField(right.kind, left.kind);
      if (reverseField) {
        removed = (await QuickEdit.#removeFromField(right.kind, right.id, reverseField, left.id)) || removed;
      }
      return removed;
    } catch (error) {
      console.error("N&D Companion: removeRelationship failed", error);
      return false;
    }
  }

  static #normalizeRef(ref) {
    if (!ref?.kind || !ref?.id) return null;
    const kind = ref.kind === "scene" ? "location" : ref.kind === "beat" ? "questEntry" : ref.kind;
    return { kind, id: ref.id };
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
    if (badge.classList.contains("nd-status-dot")) {
      const meta = QuickEdit.#statusDotMeta(kind, next);
      badge.textContent = meta.letter;
      badge.title = meta.label;
      badge.setAttribute("aria-label", `${meta.label}. Click to cycle status.`);
    } else {
      badge.textContent = next;
    }
    options.onRefresh?.();
  }

  /**
   * @param {string} kind
   * @param {string} status
   * @returns {{ letter: string, label: string }}
   */
  static #statusDotMeta(kind, status) {
    if (kind === "questEntry") {
      if (status === "ACTIVE") return { letter: "A", label: "Active" };
      if (status === "COMPLETED") return { letter: "C", label: "Completed" };
      return { letter: "P", label: "Planned" };
    }
    if (kind === "storyThread") {
      if (status === "DORMANT") return { letter: "D", label: "Dormant" };
      if (status === "RESOLVED") return { letter: "C", label: "Resolved" };
      if (status === "HIDDEN") return { letter: "H", label: "Hidden" };
      return { letter: "A", label: "Active" };
    }
    return { letter: String(status || "?").slice(0, 1).toUpperCase(), label: String(status || "Status") };
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
    const field = QuickEdit.#relationshipField(ownerKind, related.kind);
    if (!field) return null;
    return { [field]: [related.id] };
  }

  /**
   * @param {string} ownerKind
   * @param {string} relatedKind
   * @returns {string|null}
   */
  static #relationshipField(ownerKind, relatedKind) {
    const kind = relatedKind === "scene" ? "location" : relatedKind;
    if (ownerKind === "storyThread") {
      if (kind === "actor") return "relatedActorIds";
      if (kind === "location") return "relatedLocationIds";
      if (kind === "item") return "relatedItemIds";
      if (kind === "quest") return "relatedQuestIds";
      if (kind === "session") return "relatedSessionIds";
      return null;
    }
    if (ownerKind === "questEntry") {
      if (kind === "actor") return "relatedCharacterIds";
      if (kind === "location") return "relatedLocationIds";
      if (kind === "item") return "relatedItemIds";
      if (kind === "questEntry") return "relatedBeatIds";
      return null;
    }
    if (ownerKind === "faction") {
      if (kind === "actor") return "relatedActorIds";
      if (kind === "storyThread") return "relatedStoryThreadIds";
      if (kind === "location") return "relatedLocationIds";
      if (kind === "item") return "relatedItemIds";
      if (kind === "quest") return "relatedQuestIds";
      if (kind === "faction") return "relatedFactionIds";
      if (kind === "session") return "relatedSessionIds";
      return null;
    }
    return null;
  }

  static async #removeFromField(kind, id, field, relatedId) {
    if (kind === "storyThread") {
      const thread = StoryThreadService.getById(id);
      if (!thread || !Array.isArray(thread[field])) return false;
      if (!thread[field].includes(relatedId)) return false;
      return Boolean(await StoryThreadService.update(id, {
        [field]: thread[field].filter((value) => value !== relatedId)
      }));
    }
    if (kind === "questEntry") {
      const entry = QuestEntryService.getById(id);
      if (!entry || !Array.isArray(entry[field])) return false;
      if (!entry[field].includes(relatedId)) return false;
      const updated = await QuestEntryService.update(id, {
        [field]: entry[field].filter((value) => value !== relatedId)
      });
      if (updated) await QuickEdit.#refreshPlayIfLoaded(id);
      return Boolean(updated);
    }
    if (kind === "faction") {
      const faction = FactionService.getById(id);
      if (!faction || !Array.isArray(faction[field])) return false;
      if (!faction[field].includes(relatedId)) return false;
      return Boolean(await FactionService.update(id, {
        [field]: faction[field].filter((value) => value !== relatedId)
      }));
    }
    return false;
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
