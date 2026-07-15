import { LiveNotes } from "./live-notes.js";

/**
 * Focus detection model for the Companion Focus Panel.
 * Sprint 6A/7: identity + Companion Memory wiring via Live Notes.
 */
export class FocusPanel {
  /**
   * @returns {{
   *   kind: "party",
   *   name: string
   * } | {
   *   kind: "actor",
   *   uuid: string,
   *   name: string,
   *   img: string,
   *   type: string
   * }}
   */
  static get() {
    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length !== 1) {
      return { kind: "party", name: "Party" };
    }

    const actor = controlled[0].actor;
    if (!actor?.uuid) {
      return { kind: "party", name: "Party" };
    }

    const typeLabel =
      CONFIG.Actor?.typeLabels?.[actor.type] ?? actor.type;

    return {
      kind: "actor",
      uuid: actor.uuid,
      name: actor.name || "Unnamed",
      img: actor.img || Actor.DEFAULT_ICON,
      type: game.i18n.localize(typeLabel)
    };
  }

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
   * @param {ReturnType<typeof FocusPanel.get>} model
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
   * @param {ReturnType<typeof FocusPanel.get>} model
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

  static #refreshOpen() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!app?.element) return;
    FocusPanel.paint(app.element, FocusPanel.get());
  }

  /**
   * Keep the open Companion Focus Panel in sync via Foundry hooks.
   */
  static registerHooks() {
    const refresh = () => FocusPanel.#refreshOpen();

    Hooks.on("controlToken", refresh);
    Hooks.on("updateActor", refresh);
    Hooks.on("canvasReady", refresh);
  }
}
