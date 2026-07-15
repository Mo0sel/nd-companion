/**
 * Focus detection model for the Companion Focus Panel.
 * Sprint 6A: identity only (portrait, name, type). Extensible via kind.
 */
export class FocusPanel {
  /**
   * @returns {{
   *   kind: "party",
   *   name: string
   * } | {
   *   kind: "actor",
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
    if (!actor) {
      return { kind: "party", name: "Party" };
    }

    const typeLabel =
      CONFIG.Actor?.typeLabels?.[actor.type] ?? actor.type;

    return {
      kind: "actor",
      name: actor.name || "Unnamed",
      img: actor.img || Actor.DEFAULT_ICON,
      type: game.i18n.localize(typeLabel)
    };
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
