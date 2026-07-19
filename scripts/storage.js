const MODULE_ID = "nd-companion";
const MEMORY_SETTING = "campaignMemory";
const CAMPAIGN_SETTING = "campaign";

/**
 * World-setting persistence for Companion live notes and campaign memory.
 * UI code must use this API — never call game.settings directly.
 *
 * Legacy sessionNotes / sessionSummary remain registered through the 0.2.x
 * beta cycle as migration shims. Remove after the first stable migration.
 *
 * After CampaignDocument.ready(), session note keys are bridged to the active
 * Session so Live Notes keeps working without UI changes.
 */
export class CompanionStorage {
  /**
   * Optional bridge registered by SessionService after campaign ready.
   * @type {{
   *   getNotes: () => string,
   *   setNotes: (value: string) => Promise<string>,
   *   getSummary: () => string,
 *   setSummary: (value: string) => Promise<string>,
 *   getLog?: () => string,
 *   setLog?: (value: string) => Promise<string>
   * }|null}
   */
  static #sessionBridge = null;

  /**
   * @param {{
   *   getNotes: () => string,
   *   setNotes: (value: string) => Promise<string>,
   *   getSummary: () => string,
   *   setSummary: (value: string) => Promise<string>
   * }|null} bridge
   */
  static setSessionBridge(bridge) {
    CompanionStorage.#sessionBridge = bridge;
  }

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

    // Legacy through 0.2.x beta — routed to active Session after migration.
    game.settings.register(MODULE_ID, "sessionNotes", {
      name: "sessionNotes",
      scope: "world",
      config: false,
      type: String,
      default: ""
    });

    // Legacy through 0.2.x beta — routed to active Session after migration.
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

    game.settings.register(MODULE_ID, CAMPAIGN_SETTING, {
      name: CAMPAIGN_SETTING,
      scope: "world",
      config: false,
      type: Object,
      default: {
        schemaVersion: 0,
        activeSessionId: "",
        sessions: [],
        threads: [],
        questEntries: []
      }
    });
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  static get(key) {
    if (key === "sessionNotes") {
      return CompanionStorage.#sessionBridge
        ? CompanionStorage.#sessionBridge.getNotes()
        : CompanionStorage.getLegacySessionNotes();
    }
    if (key === "sessionSummary") {
      return CompanionStorage.#sessionBridge
        ? CompanionStorage.#sessionBridge.getSummary()
        : CompanionStorage.getLegacySessionSummary();
    }
    if (key === "sessionLog") {
      return CompanionStorage.#sessionBridge?.getLog?.()
        ?? CompanionStorage.#sessionBridge?.getSummary?.()
        ?? CompanionStorage.getLegacySessionSummary();
    }
    return game.settings.get(MODULE_ID, key) ?? "";
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {Promise<string>}
   */
  static async set(key, value) {
    if (key === "sessionNotes") {
      if (CompanionStorage.#sessionBridge) {
        return CompanionStorage.#sessionBridge.setNotes(value ?? "");
      }
      return game.settings.set(MODULE_ID, "sessionNotes", value ?? "");
    }
    if (key === "sessionSummary") {
      if (CompanionStorage.#sessionBridge) {
        return CompanionStorage.#sessionBridge.setSummary(value ?? "");
      }
      return game.settings.set(MODULE_ID, "sessionSummary", value ?? "");
    }
    if (key === "sessionLog") {
      if (CompanionStorage.#sessionBridge?.setLog) {
        return CompanionStorage.#sessionBridge.setLog(value ?? "");
      }
      if (CompanionStorage.#sessionBridge?.setSummary) {
        return CompanionStorage.#sessionBridge.setSummary(value ?? "");
      }
      return game.settings.set(MODULE_ID, "sessionSummary", value ?? "");
    }
    return game.settings.set(MODULE_ID, key, value ?? "");
  }

  /**
   * Raw legacy Session Notes value (migration only).
   * @returns {string}
   */
  static getLegacySessionNotes() {
    return game.settings.get(MODULE_ID, "sessionNotes") ?? "";
  }

  /**
   * Raw legacy Session Summary value (migration only).
   * @returns {string}
   */
  static getLegacySessionSummary() {
    return game.settings.get(MODULE_ID, "sessionSummary") ?? "";
  }

  /**
   * Clear legacy flat fields after successful Session migration.
   * Settings stay registered through 0.2.x beta.
   * @returns {Promise<void>}
   */
  static async clearLegacySessionFields() {
    await game.settings.set(MODULE_ID, "sessionNotes", "");
    await game.settings.set(MODULE_ID, "sessionSummary", "");
  }

  /**
   * @returns {{ schemaVersion: number, activeSessionId: string, sessions: object[], threads: object[], questEntries: object[] }}
   */
  static getCampaign() {
    const doc = game.settings.get(MODULE_ID, CAMPAIGN_SETTING);
    return foundry.utils.duplicate(
      doc ?? {
        schemaVersion: 0,
        activeSessionId: "",
        sessions: [],
        threads: [],
        questEntries: []
      }
    );
  }

  /**
   * @param {{ schemaVersion: number, activeSessionId: string, sessions: object[], threads: object[], questEntries: object[] }} value
   * @returns {Promise<object>}
   */
  static async setCampaign(value) {
    return game.settings.set(
      MODULE_ID,
      CAMPAIGN_SETTING,
      foundry.utils.duplicate(
        value ?? {
          schemaVersion: 0,
          activeSessionId: "",
          sessions: [],
          threads: [],
          questEntries: []
        }
      )
    );
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
