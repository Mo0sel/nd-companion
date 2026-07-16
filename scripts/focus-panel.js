import { LiveNotes } from "./live-notes.js";

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

    const nameEl = root.querySelector("[data-focus=\"name\"]");
    if (nameEl) nameEl.textContent = model.name;

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
    if (!emptyEl || !editorEl) return;

    if (model.kind === "actor" && model.uuid) {
      emptyEl.hidden = true;
      editorEl.hidden = false;
      LiveNotes.attach(editorEl, FocusPanel.memoryKey("actor", model.uuid), { memory: true });
      return;
    }

    LiveNotes.detach(editorEl);
    editorEl.hidden = true;
    editorEl.textContent = "";
    emptyEl.hidden = false;
  }
}
