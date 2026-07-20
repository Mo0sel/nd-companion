const MODULE_ID = "nd-companion";
const MEMORY_SETTING = "campaignMemory";
const CAMPAIGN_SETTING = "campaign";
const ACTIVITY_SETTING = "campaignActivity";

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
        storyEntries: [],
        storyThreads: [],
        factions: []
      }
    });

    game.settings.register(MODULE_ID, ACTIVITY_SETTING, {
      name: ACTIVITY_SETTING,
      scope: "world",
      config: false,
      type: Object,
      default: { events: [] }
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
   * @returns {{ schemaVersion: number, activeSessionId: string, sessions: object[], threads: object[], storyEntries: object[], storyThreads: object[], factions: object[] }}
   */
  static getCampaign() {
    const doc = game.settings.get(MODULE_ID, CAMPAIGN_SETTING);
    return foundry.utils.duplicate(
      doc ?? {
        schemaVersion: 0,
        activeSessionId: "",
        sessions: [],
        threads: [],
        storyEntries: [],
        storyThreads: [],
        factions: []
      }
    );
  }

  /**
   * @param {{ schemaVersion: number, activeSessionId: string, sessions: object[], threads: object[], storyEntries: object[], storyThreads: object[], factions: object[] }} value
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
          storyEntries: [],
          storyThreads: [],
          factions: []
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
    const result = await game.settings.set(MODULE_ID, MEMORY_SETTING, bag);
    try {
      const { CampaignActivityService } = await import("./campaign-activity-service.js");
      CampaignActivityService.recordMemoryWrite(key, value ?? "");
    } catch (error) {
      console.error("N&D Companion: activity record failed", error);
    }
    return result;
  }

  /**
   * @returns {import("./campaign-activity-service.js").CampaignActivityEvent[]}
   */
  static getActivityEvents() {
    const doc = game.settings.get(MODULE_ID, ACTIVITY_SETTING);
    if (!Array.isArray(doc?.events)) return [];
    return doc.events
      .filter((event) => event && typeof event.id === "string")
      .map((event) => ({
        id: event.id,
        timestamp: Number(event.timestamp) || 0,
        action: event.action === "created" || event.action === "deleted"
          ? event.action
          : "edited",
        entityKind: String(event.entityKind ?? ""),
        entityId: String(event.entityId ?? ""),
        entityName: String(event.entityName ?? "Untitled"),
        fieldName: typeof event.fieldName === "string" ? event.fieldName : null
      }));
  }

  /**
   * @param {import("./campaign-activity-service.js").CampaignActivityEvent[]} events
   */
  static async setActivityEvents(events) {
    return game.settings.set(MODULE_ID, ACTIVITY_SETTING, {
      events: foundry.utils.duplicate(Array.isArray(events) ? events : [])
    });
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

  /* ── Serialization layer (Sprint 30A) ─────────────────────────────────
   * Internal API for every future persistence feature (export, import,
   * snapshots, health check). Read-only: nothing here writes to storage.
   */

  /**
   * Serialize the entire Companion state into one payload.
   * @returns {CampaignPayload}
   */
  static serializeCampaign() {
    const campaign = CompanionStorage.getCampaign();
    return {
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? "",
      schemaVersion: Number.isFinite(campaign.schemaVersion) ? campaign.schemaVersion : 0,
      foundryVersion: game.version ?? "",
      exportedAt: new Date().toISOString(),

      campaign,
      playbook: CompanionStorage.getPlaybook(),
      campaignMemory: foundry.utils.duplicate(
        game.settings.get(MODULE_ID, MEMORY_SETTING) ?? {}
      )
    };
  }

  /**
   * Validate an external payload without normalizing or importing it.
   * @param {unknown} payload
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateCampaignPayload(payload) {
    /** @type {string[]} */
    const errors = [];

    if (payload === null || payload === undefined) {
      errors.push("Payload is missing.");
      return { valid: false, errors };
    }
    if (typeof payload !== "object" || Array.isArray(payload)) {
      errors.push("Payload must be a plain object.");
      return { valid: false, errors };
    }

    if (payload.moduleVersion === undefined || payload.moduleVersion === null) {
      errors.push("Payload is missing \"moduleVersion\".");
    }
    if (payload.schemaVersion === undefined || payload.schemaVersion === null) {
      errors.push("Payload is missing \"schemaVersion\".");
    }
    if (!payload.campaign || typeof payload.campaign !== "object") {
      errors.push("Payload is missing \"campaign\".");
    }
    if (!payload.playbook || typeof payload.playbook !== "object") {
      errors.push("Payload is missing \"playbook\".");
    }
    if (!payload.campaignMemory || typeof payload.campaignMemory !== "object") {
      errors.push("Payload is missing \"campaignMemory\".");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate and normalize a payload. Does NOT write to storage or import.
   * @param {unknown} payload
   * @returns {CampaignPayload} Normalized copy, detached from the input
   * @throws {Error} Descriptive error when the payload is invalid
   */
  static deserializeCampaign(payload) {
    const { valid, errors } = CompanionStorage.validateCampaignPayload(payload);
    if (!valid) {
      throw new Error(`Invalid Companion campaign payload: ${errors.join(" ")}`);
    }

    const schemaVersion = Number(payload.schemaVersion);
    if (!Number.isFinite(schemaVersion) || schemaVersion < 0) {
      throw new Error(
        `Invalid Companion campaign payload: "schemaVersion" must be a non-negative number, got ${JSON.stringify(payload.schemaVersion)}.`
      );
    }

    const campaign = foundry.utils.duplicate(payload.campaign);
    campaign.activeSessionId =
      typeof campaign.activeSessionId === "string" ? campaign.activeSessionId : "";
    campaign.sessions = Array.isArray(campaign.sessions) ? campaign.sessions : [];
    campaign.threads = Array.isArray(campaign.threads) ? campaign.threads : [];
    campaign.storyEntries = Array.isArray(campaign.storyEntries)
      ? campaign.storyEntries
      : Array.isArray(campaign.questEntries) ? campaign.questEntries : [];
    delete campaign.questEntries;
    campaign.storyThreads = Array.isArray(campaign.storyThreads) ? campaign.storyThreads : [];
    campaign.factions = Array.isArray(campaign.factions) ? campaign.factions : [];
    campaign.schemaVersion = Number.isFinite(campaign.schemaVersion)
      ? campaign.schemaVersion
      : schemaVersion;

    const playbook = foundry.utils.duplicate(payload.playbook);
    playbook.currentIndex = Number.isInteger(playbook.currentIndex) && playbook.currentIndex >= 0
      ? playbook.currentIndex
      : 0;
    playbook.beats = Array.isArray(playbook.beats) ? playbook.beats : [];

    /** @type {Record<string, string>} */
    const campaignMemory = {};
    for (const [key, value] of Object.entries(foundry.utils.duplicate(payload.campaignMemory))) {
      if (typeof key === "string" && key && typeof value === "string") {
        campaignMemory[key] = value;
      }
    }

    return {
      moduleVersion: String(payload.moduleVersion),
      schemaVersion,
      foundryVersion: typeof payload.foundryVersion === "string" ? payload.foundryVersion : "",
      exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : "",

      campaign,
      playbook,
      campaignMemory
    };
  }

  /**
   * Apply an already validated and normalized campaign payload.
   * All writes use existing CompanionStorage APIs. If a write fails, the
   * previous stored values are restored before the error is rethrown.
   * @param {CampaignPayload} payload
   * @returns {Promise<void>}
   */
  static async applyCampaignPayload(payload) {
    const previous = {
      campaign: CompanionStorage.getCampaign(),
      playbook: CompanionStorage.getPlaybook(),
      campaignMemory: foundry.utils.duplicate(
        game.settings.get(MODULE_ID, MEMORY_SETTING) ?? {}
      )
    };

    try {
      await CompanionStorage.setCampaign(foundry.utils.duplicate(payload.campaign));
      await CompanionStorage.setPlaybook(foundry.utils.duplicate(payload.playbook));
      await CompanionStorage.set(
        MEMORY_SETTING,
        foundry.utils.duplicate(payload.campaignMemory)
      );
    } catch (error) {
      await Promise.allSettled([
        CompanionStorage.setCampaign(previous.campaign),
        CompanionStorage.setPlaybook(previous.playbook),
        CompanionStorage.set(MEMORY_SETTING, previous.campaignMemory)
      ]);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Campaign import failed: ${message}`);
    }
  }
}

/**
 * Complete Companion state for persistence features.
 * @typedef {object} CampaignPayload
 * @property {string} moduleVersion
 * @property {number} schemaVersion
 * @property {string} foundryVersion
 * @property {string} exportedAt
 * @property {object} campaign Campaign document (sessions, quests, story entries, story threads)
 * @property {{ currentIndex: number, beats: object[] }} playbook
 * @property {Record<string, string>} campaignMemory Per-document memory bag
 */
