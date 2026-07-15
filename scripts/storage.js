const MODULE_ID = "nd-companion";

/**
 * World-setting persistence for Companion live notes.
 * UI code must use this API — never call game.settings directly.
 */
export class CompanionStorage {
  /**
   * Register storage keys during module init.
   */
  static register() {
    const keys = ["currentBeat"];
    for (const key of keys) {
      game.settings.register(MODULE_ID, key, {
        name: key,
        scope: "world",
        config: false,
        type: String,
        default: ""
      });
    }
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
}
