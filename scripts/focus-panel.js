import { CampaignMemoryService } from "./campaign-memory-service.js";
import { LiveNotes } from "./live-notes.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";

/**
 * Renders focus-driven Companion Memory (Focus Notes) from FocusManager.
 * Portrait chrome was removed in Sprint 16B; FocusManager behavior is unchanged.
 */
export class FocusPanel {
  /**
   * Build a storage key for document-scoped Companion Memory.
   * @param {"actor"|"scene"|"journal"|"item"} kind
   * @param {string} uuid
   * @returns {string}
   */
  static memoryKey(kind, uuid) {
    return `${kind}:${uuid}`;
  }

  /**
   * @param {HTMLElement} root
   * @param {ReturnType<import("./focus-manager.js").FocusManager["get"]>} model
   */
  static paint(root, model) {
    if (!(root instanceof HTMLElement) || !model) return;

    root.querySelectorAll("[data-focus=\"name\"]").forEach((nameEl) => {
      nameEl.textContent = model.name;
    });

    const initials = String(model.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
    root.querySelectorAll("[data-focus=\"initials\"]").forEach((el) => {
      el.textContent = initials || "P";
    });

    const portraitEl = root.querySelector("[data-focus=\"portrait\"]");
    const typeEl = root.querySelector("[data-focus=\"type\"]");
    const typeRow = root.querySelector("[data-focus-row=\"type\"]");

    if (portraitEl || typeRow || typeEl) {
      if (model.kind === "actor") {
        if (portraitEl) {
          portraitEl.hidden = false;
          portraitEl.src = model.img;
          portraitEl.alt = model.name;
        }
        if (typeRow) typeRow.hidden = false;
        if (typeEl) typeEl.textContent = model.type;
      } else {
        if (portraitEl) {
          portraitEl.hidden = true;
          portraitEl.removeAttribute("src");
          portraitEl.alt = "";
        }
        if (typeRow) typeRow.hidden = true;
        if (typeEl) typeEl.textContent = "";
      }
    }

    FocusPanel.#paintMemory(root, model);
  }

  /**
   * @param {HTMLElement} root
   * @param {Parameters<typeof FocusPanel.paint>[1]} model
   */
  static #paintMemory(root, model) {
    const section = root.querySelector("[data-companion-memory]");
    if (!section) return;

    const emptyEl = section.querySelector("[data-memory-empty]");
    const editorEl = section.querySelector("[data-memory-editor]");
    const toolbarEl = section.querySelector("[data-memory-toolbar]");
    if (!emptyEl || !editorEl) return;

    if (model.kind === "actor" && model.uuid) {
      emptyEl.hidden = true;
      if (toolbarEl instanceof HTMLElement) toolbarEl.hidden = false;
      editorEl.hidden = false;
      RichTextToolbar.attach(section);
      LiveNotes.attach(editorEl, FocusPanel.memoryKey("actor", model.uuid), {
        memory: true,
        html: true,
        sanitize: RichText.sanitize
      });
      FocusPanel.#paintHistory(section, model.uuid);
      return;
    }

    LiveNotes.detach(editorEl);
    if (toolbarEl instanceof HTMLElement) toolbarEl.hidden = true;
    editorEl.hidden = true;
    editorEl.innerHTML = "";
    emptyEl.hidden = false;
    FocusPanel.#paintHistory(section, null);
  }

  /**
   * @param {HTMLElement} section
   * @param {string|null} uuid
   */
  static #paintHistory(section, uuid) {
    const historySection = section.querySelector("[data-actor-history]");
    if (!(historySection instanceof HTMLElement)) return;

    if (!uuid) {
      historySection.hidden = true;
      return;
    }

    const history = CampaignMemoryService.historyFor({ kind: "actor", id: uuid });
    const hasHistory = history.mentionCount > 0;
    historySection.hidden = !hasHistory;
    if (!hasHistory) return;

    const first = historySection.querySelector("[data-actor-history-first]");
    const last = historySection.querySelector("[data-actor-history-last]");
    const count = historySection.querySelector("[data-actor-history-count]");
    const list = historySection.querySelector("[data-actor-history-list]");
    if (first) first.textContent = history.firstAppearance?.label ?? "—";
    if (last) last.textContent = history.lastAppearance?.label ?? "—";
    if (count) count.textContent = String(history.mentionCount);
    if (!list) return;

    list.replaceChildren();
    for (const appearance of history.appearsIn) {
      const item = document.createElement("div");
      item.className = "nd-object-history__item nd-object-history__item--static";
      item.textContent = appearance.label;
      list.append(item);
    }
  }
}
