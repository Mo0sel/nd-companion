const MODULE_ID = "nd-companion";
const MEMORY_SETTING = "campaignMemory";

/**
 * World-setting persistence for Companion live notes and campaign memory.
 * UI code must use this API — never call game.settings directly.
 */
export class CompanionStorage {
  /**
   * Register storage keys during module init.
   */
  static register() {
    game.settings.register(MODULE_ID, "currentBeat", {
      name: "currentBeat",
      scope: "world",
      config: false,
      type: String,
      default: ""
    });

    game.settings.register(MODULE_ID, "sessionNotes", {
      name: "sessionNotes",
      scope: "world",
      config: false,
      type: String,
      default: ""
    });

    // Temporary single-summary field. This intentionally does not introduce
    // session history; the UI can migrate to that future model unchanged.
    game.settings.register(MODULE_ID, "sessionSummary", {
      name: "sessionSummary",
      scope: "world",
      config: false,
      type: String,
      default: ""
    });

    game.settings.register(MODULE_ID, MEMORY_SETTING, {
      name: MEMORY_SETTING,
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });

    game.settings.register(MODULE_ID, "playbook", {
      name: "playbook",
      scope: "world",
      config: false,
      type: Object,
      default: { currentIndex: 0, beats: [] }
    });
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  static get(key) {
    return game.settings.get(MODULE_ID, key) ?? "";
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {Promise<string>}
   */
  static async set(key, value) {
    return game.settings.set(MODULE_ID, key, value ?? "");
  }

  /**
   * Read a document memory entry from the campaignMemory world setting.
   * @param {string} key e.g. "actor:Actor.xxxxx"
   * @returns {string}
   */
  static getMemory(key) {
    if (!key) return "";
    const bag = game.settings.get(MODULE_ID, MEMORY_SETTING) ?? {};
    return bag[key] ?? "";
  }

  /**
   * Write a document memory entry into the campaignMemory world setting.
   * @param {string} key e.g. "actor:Actor.xxxxx"
   * @param {string} value
   * @returns {Promise<object>}
   */
  static async setMemory(key, value) {
    const bag = foundry.utils.duplicate(game.settings.get(MODULE_ID, MEMORY_SETTING) ?? {});
    bag[key] = value ?? "";
    return game.settings.set(MODULE_ID, MEMORY_SETTING, bag);
  }

  /**
   * @returns {{ currentIndex: number, beats: object[] }}
   */
  static getPlaybook() {
    const doc = game.settings.get(MODULE_ID, "playbook");
    return foundry.utils.duplicate(doc ?? { currentIndex: 0, beats: [] });
  }

  /**
   * @param {{ currentIndex: number, beats: object[] }} value
   * @returns {Promise<object>}
   */
  static async setPlaybook(value) {
    return game.settings.set(
      MODULE_ID,
      "playbook",
      foundry.utils.duplicate(value ?? { currentIndex: 0, beats: [] })
    );
  }
}
