import { CampaignAwareness, CampaignContext } from "./campaign-context.js";
import { FocusPanel } from "./focus-panel.js";
import { LiveNotes } from "./live-notes.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The N&D Companion window.
 */
export class CompanionApp extends HandlebarsApplicationMixin(ApplicationV2) {
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
    }
  };

  static PARTS = {
    content: {
      template: "modules/nd-companion/templates/companion.hbs"
    }
  };

  /**
   * @param {ApplicationRenderContext} _context
   * @param {ApplicationRenderOptions} _options
   */
  async _onRender(_context, _options) {
    await super._onRender(_context, _options);
    CampaignAwareness.paint(this.element, CampaignContext.get());
    FocusPanel.paint(this.element, FocusPanel.get());
    this.element.querySelectorAll("[data-storage]:not([data-memory-editor])").forEach((el) => {
      LiveNotes.attach(el, el.dataset.storage);
    });
  }
}

