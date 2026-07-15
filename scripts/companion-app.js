import { CampaignAwareness, CampaignContext } from "./campaign-context.js";
import { FocusPanel } from "./focus-panel.js";
import { LiveNotes } from "./live-notes.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const WORKSPACES = new Set(["play", "notes", "prepare"]);

/**
 * The N&D Companion window.
 */
export class CompanionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {"play"|"notes"|"prepare"} */
  workspace = "play";

  static DEFAULT_OPTIONS = {
    id: "nd-companion-app",
    tag: "div",
    classes: ["nd-companion"],
    window: {
      title: "N&D Companion",
      icon: "fa-solid fa-robot",
      resizable: true
    },
    position: {
      width: 700,
      height: "auto"
    },
    actions: {
      setWorkspace: CompanionApp.#onSetWorkspace
    }
  };

  static PARTS = {
    content: {
      template: "modules/nd-companion/templates/companion.hbs"
    }
  };

  /**
   * Switch the lower workspace region. Safe to call from actions or future hotkeys.
   * @param {"play"|"notes"|"prepare"} workspace
   */
  setWorkspace(workspace) {
    if (!WORKSPACES.has(workspace)) return;
    this.workspace = workspace;
    this.#applyWorkspace();
  }

  /**
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onSetWorkspace(_event, target) {
    this.setWorkspace(target.dataset.workspace);
  }

  #applyWorkspace() {
    const root = this.element;
    if (!root) return;

    root.querySelectorAll("[data-workspace-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.workspacePanel !== this.workspace;
    });

    root.querySelectorAll("[data-action=\"setWorkspace\"]").forEach((button) => {
      const active = button.dataset.workspace === this.workspace;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
  }

  /**
   * @param {ApplicationRenderContext} _context
   * @param {ApplicationRenderOptions} _options
   */
  async _onRender(_context, _options) {
    await super._onRender(_context, _options);
    this.#applyWorkspace();
    CampaignAwareness.paint(this.element, CampaignContext.get());
    FocusPanel.paint(this.element, FocusPanel.get());
    this.element.querySelectorAll("[data-storage]:not([data-memory-editor])").forEach((el) => {
      LiveNotes.attach(el, el.dataset.storage);
    });
  }
}
