import { FocusManager } from "./focus-manager.js";

/**
 * Read-only snapshot of live Foundry world state for the Companion.
 */
export class CampaignContext {
  /**
   * @returns {{
   *   campaignTitle: string,
   *   scene: string|null,
   *   focus: string,
   *   combat: null|{ round: number, turn: string|null }
   * }}
   */
  static get() {
    const campaignTitle = game.world?.title?.trim() || game.world?.id || "Campaign";

    const sceneDoc = canvas?.scene ?? game.scenes?.viewed ?? null;
    const scene = sceneDoc?.name || null;

    const focusModel = FocusManager.get();
    const focus = focusModel.kind === "actor" ? focusModel.name : "Party";

    const combatDoc = game.combat;
    let combat = null;
    if (combatDoc?.started) {
      combat = {
        round: combatDoc.round,
        turn: combatDoc.combatant?.name || null
      };
    }

    return { campaignTitle, scene, focus, combat };
  }
}

/**
 * Paints Campaign Context into the Companion DOM and keeps it live via hooks.
 */
export class CampaignAwareness {
  /**
   * @param {HTMLElement} root
   * @param {ReturnType<typeof CampaignContext.get>} context
   */
  static paint(root, context) {
    if (!(root instanceof HTMLElement) || !context) return;

    const titleEl = root.querySelector("[data-context=\"campaign-title\"]");
    if (titleEl) titleEl.textContent = context.campaignTitle;

    const setItem = (key, value) => {
      const el = root.querySelector(`[data-context="${key}"]`);
      if (!el) return;
      const visible = value !== null && value !== undefined && value !== "";
      el.hidden = !visible;
      const sep = root.querySelector(`[data-context-sep="${key}"]`);
      if (sep) sep.hidden = !visible;
      if (visible) {
        const valueEl = el.querySelector("[data-context-value]");
        if (valueEl) valueEl.textContent = String(value);
      }
    };

    setItem("scene", context.scene);
    setItem("focus", context.focus);

    const combatActive = Boolean(context.combat);
    setItem("combat", combatActive ? "Active" : null);
    setItem("round", combatActive ? context.combat.round : null);
    setItem("turn", combatActive ? context.combat.turn : null);
  }

  static #refreshOpen() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!app?.element) return;
    CampaignAwareness.paint(app.element, CampaignContext.get());
  }

  /**
   * Register Foundry hooks once so an open Companion stays in sync.
   */
  static registerHooks() {
    const refresh = () => CampaignAwareness.#refreshOpen();

    Hooks.on("canvasReady", refresh);
    Hooks.on("controlToken", refresh);
    Hooks.on("combatStart", refresh);
    Hooks.on("combatRound", refresh);
    Hooks.on("combatTurn", refresh);
    Hooks.on("combatTurnChange", refresh);
    Hooks.on("updateCombat", refresh);
    Hooks.on("deleteCombat", refresh);
  }
}
