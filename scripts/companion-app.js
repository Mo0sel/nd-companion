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
      width: 320,
      height: "auto"
    }
  };

  static PARTS = {
    content: {
      template: "modules/nd-companion/templates/companion.hbs"
    }
  };
}
