import { LiveNotes } from "./live-notes.js";

/**
 * Renders the Companion Focus Panel from a focus model supplied by FocusManager.
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

    const panel = root.querySelector("[data-focus-panel]");
    if (!panel) return;

    panel.dataset.focusKind = model.kind;

    const nameEl = panel.querySelector("[data-focus=\"name\"]");
    if (nameEl) nameEl.textContent = model.name;

    const portraitEl = panel.querySelector("[data-focus=\"portrait\"]");
    const typeEl = panel.querySelector("[data-focus=\"type\"]");
    const typeRow = panel.querySelector("[data-focus-row=\"type\"]");

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
