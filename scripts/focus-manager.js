import { CampaignAwareness, CampaignContext } from "./campaign-context.js";
import { FocusPanel } from "./focus-panel.js";

/**
 * Focus state and resolution for the Companion.
 * Canvas token selection wins over ephemeral logical focus set by Navigation.
 */
export class FocusManager {
  /** @type {string|null} */
  static #logicalFocusUuid = null;

  /** @type {boolean} */
  static #hooksRegistered = false;

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
    if (controlled.length === 1) {
      const actor = controlled[0].actor;
      if (actor?.uuid) return FocusManager.#actorModel(actor);
    }

    if (FocusManager.#logicalFocusUuid) {
      const actor = FocusManager.#findActor(FocusManager.#logicalFocusUuid);
      if (actor) return FocusManager.#actorModel(actor);
      FocusManager.#logicalFocusUuid = null;
    }

    return { kind: "party", name: "Party" };
  }

  /**
   * @param {string} actorUuid
   */
  static setLogicalFocus(actorUuid) {
    if (!actorUuid) return;
    FocusManager.#logicalFocusUuid = actorUuid;
    FocusManager.refreshOpen();
  }

  static clearLogicalFocus() {
    if (!FocusManager.#logicalFocusUuid) return;
    FocusManager.#logicalFocusUuid = null;
    FocusManager.refreshOpen();
  }

  static refreshOpen() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!app?.element) return;
    CampaignAwareness.paint(app.element, CampaignContext.get());
    FocusPanel.paint(app.element, FocusManager.get());
  }

  static registerHooks() {
    if (FocusManager.#hooksRegistered) return;
    FocusManager.#hooksRegistered = true;

    Hooks.on("controlToken", () => {
      FocusManager.#logicalFocusUuid = null;
      FocusManager.refreshOpen();
    });
    Hooks.on("updateActor", () => FocusManager.refreshOpen());
    Hooks.on("deleteActor", (document) => {
      if (document.uuid === FocusManager.#logicalFocusUuid) {
        FocusManager.#logicalFocusUuid = null;
        FocusManager.refreshOpen();
      }
    });
    Hooks.on("canvasReady", () => FocusManager.refreshOpen());
  }

  /**
   * @param {foundry.documents.Actor} actor
   */
  static #actorModel(actor) {
    const typeLabel = CONFIG.Actor?.typeLabels?.[actor.type] ?? actor.type;

    return {
      kind: "actor",
      uuid: actor.uuid,
      name: actor.name || "Unnamed",
      img: actor.img || Actor.DEFAULT_ICON,
      type: game.i18n.localize(typeLabel)
    };
  }

  /**
   * @param {string} uuid
   * @returns {foundry.documents.Actor|null}
   */
  static #findActor(uuid) {
    if (!uuid || !game.actors) return null;
    for (const actor of game.actors) {
      if (actor.uuid === uuid) return actor;
    }
    return null;
  }
}
