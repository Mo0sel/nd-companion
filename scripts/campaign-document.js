import { CompanionStorage } from "./storage.js";

/** @typedef {"planned"|"active"|"completed"} SessionStatus */
/** @typedef {"OPEN"|"ACTIVE"|"RESOLVED"} ThreadStatus */

/**
 * @typedef {object} CampaignSession
 * @property {string} id
 * @property {string} title
 * @property {number} sessionNumber
 * @property {SessionStatus} status
 * @property {string} inGameDate
 * @property {string} realDate
 * @property {string} notes
 * @property {string} summary
 * @property {string[]} beatIds
 * @property {number} created
 * @property {number} updated
 */

/**
 * @typedef {object} CampaignThread
 * @property {string} id
 * @property {string} title
 * @property {ThreadStatus} status
 * @property {string} [type]
 * @property {string} description
 * @property {string} notes
 * @property {string[]} relatedBeatIds
 * @property {string[]} relatedCharacterIds
 * @property {string[]} relatedLocationIds
 * @property {string[]} relatedItemIds
 * @property {number} created
 * @property {number} updated
 */

/**
 * @typedef {object} CampaignDocumentData
 * @property {number} schemaVersion
 * @property {string} activeSessionId
 * @property {CampaignSession[]} sessions
 * @property {CampaignThread[]} threads
 */

export const CAMPAIGN_SCHEMA_VERSION = 1;

export const SESSION_STATUSES = Object.freeze(["planned", "active", "completed"]);
export const THREAD_STATUSES = Object.freeze(["OPEN", "ACTIVE", "RESOLVED"]);

/**
 * In-memory campaign document (sessions + threads).
 * Single write path for SessionService and ThreadService.
 */
export class CampaignDocument {
  /** @type {CampaignDocumentData} */
  static #doc = CampaignDocument.#empty();

  /** @type {boolean} */
  static #ready = false;

  /** @returns {boolean} */
  static get isReady() {
    return CampaignDocument.#ready;
  }

  /**
   * Load or migrate the campaign document. Call after PlaybookService.ready().
   * @returns {Promise<void>}
   */
  static async ready() {
    const stored = CompanionStorage.getCampaign();
    const needsMigration =
      !stored ||
      typeof stored !== "object" ||
      !Number.isFinite(stored.schemaVersion) ||
      stored.schemaVersion < CAMPAIGN_SCHEMA_VERSION;

    if (needsMigration) {
      CampaignDocument.#doc = CampaignDocument.#migrateFromLegacy(stored);
      await CompanionStorage.setCampaign(CampaignDocument.#doc);
      await CompanionStorage.clearLegacySessionFields();
    } else {
      CampaignDocument.#doc = CampaignDocument.#normalize(stored);
    }

    CampaignDocument.#ready = true;
  }

  /**
   * @returns {CampaignDocumentData}
   */
  static get() {
    return CampaignDocument.#clone(CampaignDocument.#doc);
  }

  /**
   * Mutate the in-memory document and persist.
   * @param {(doc: CampaignDocumentData) => void} mutator
   * @returns {Promise<CampaignDocumentData>}
   */
  static async update(mutator) {
    mutator(CampaignDocument.#doc);
    CampaignDocument.#doc.schemaVersion = CAMPAIGN_SCHEMA_VERSION;
    await CompanionStorage.setCampaign(CampaignDocument.#doc);
    return CampaignDocument.get();
  }

  /**
   * @param {unknown} stored
   * @returns {CampaignDocumentData}
   */
  static #migrateFromLegacy(stored) {
    const now = Date.now();
    const playbook = CompanionStorage.getPlaybook();
    const beats = Array.isArray(playbook?.beats) ? playbook.beats : [];
    const beatIds = beats
      .map((beat) => (typeof beat?.id === "string" ? beat.id : ""))
      .filter(Boolean);

    const notes = CompanionStorage.getLegacySessionNotes();
    const summary = CompanionStorage.getLegacySessionSummary();

    const existingSessions = Array.isArray(stored?.sessions) ? stored.sessions : [];
    if (existingSessions.length > 0) {
      const normalized = CampaignDocument.#normalize({
        schemaVersion: CAMPAIGN_SCHEMA_VERSION,
        activeSessionId: stored?.activeSessionId,
        sessions: existingSessions,
        threads: stored?.threads
      });
      return normalized;
    }

    const sessionId = foundry.utils.randomID();
    /** @type {CampaignSession} */
    const session = {
      id: sessionId,
      title: "Session 1",
      sessionNumber: 1,
      status: "active",
      inGameDate: "",
      realDate: new Date().toISOString().slice(0, 10),
      notes,
      summary,
      beatIds,
      created: now,
      updated: now
    };

    return {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      activeSessionId: sessionId,
      sessions: [session],
      threads: CampaignDocument.#normalizeThreads(stored?.threads)
    };
  }

  /**
   * @param {unknown} stored
   * @returns {CampaignDocumentData}
   */
  static #normalize(stored) {
    const sessions = CampaignDocument.#normalizeSessions(stored?.sessions);
    let activeSessionId =
      typeof stored?.activeSessionId === "string" ? stored.activeSessionId : "";

    if (!sessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = sessions[0]?.id ?? "";
    }

    return {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      activeSessionId,
      sessions,
      threads: CampaignDocument.#normalizeThreads(stored?.threads)
    };
  }

  /**
   * @param {unknown} value
   * @returns {CampaignSession[]}
   */
  static #normalizeSessions(value) {
    if (!Array.isArray(value)) return [];
    return value.map((session) => CampaignDocument.normalizeSession(session));
  }

  /**
   * @param {unknown} value
   * @returns {CampaignThread[]}
   */
  static #normalizeThreads(value) {
    if (!Array.isArray(value)) return [];
    return value.map((thread) => CampaignDocument.normalizeThread(thread));
  }

  /**
   * @param {unknown} session
   * @returns {CampaignSession}
   */
  static normalizeSession(session) {
    const now = Date.now();
    const status = SESSION_STATUSES.includes(session?.status) ? session.status : "planned";
    const beatIds = Array.isArray(session?.beatIds)
      ? [...new Set(session.beatIds.filter((id) => typeof id === "string" && id))]
      : [];

    return {
      id: typeof session?.id === "string" && session.id ? session.id : foundry.utils.randomID(),
      title: typeof session?.title === "string" ? session.title : "",
      sessionNumber: Number.isFinite(session?.sessionNumber)
        ? Math.max(1, Math.trunc(session.sessionNumber))
        : 1,
      status,
      inGameDate: typeof session?.inGameDate === "string" ? session.inGameDate : "",
      realDate: typeof session?.realDate === "string" ? session.realDate : "",
      notes: typeof session?.notes === "string" ? session.notes : "",
      summary: typeof session?.summary === "string" ? session.summary : "",
      beatIds,
      created: Number.isFinite(session?.created) ? session.created : now,
      updated: Number.isFinite(session?.updated) ? session.updated : now
    };
  }

  /**
   * @param {unknown} thread
   * @returns {CampaignThread}
   */
  static normalizeThread(thread) {
    const now = Date.now();
    const status = THREAD_STATUSES.includes(thread?.status) ? thread.status : "OPEN";
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];

    return {
      id: typeof thread?.id === "string" && thread.id ? thread.id : foundry.utils.randomID(),
      title: typeof thread?.title === "string" ? thread.title : "",
      status,
      type: typeof thread?.type === "string" ? thread.type : "",
      description: typeof thread?.description === "string" ? thread.description : "",
      notes: typeof thread?.notes === "string" ? thread.notes : "",
      relatedBeatIds: idList(thread?.relatedBeatIds),
      relatedCharacterIds: idList(thread?.relatedCharacterIds),
      relatedLocationIds: idList(thread?.relatedLocationIds),
      relatedItemIds: idList(thread?.relatedItemIds),
      created: Number.isFinite(thread?.created) ? thread.created : now,
      updated: Number.isFinite(thread?.updated) ? thread.updated : now
    };
  }

  /** @returns {CampaignDocumentData} */
  static #empty() {
    return {
      schemaVersion: 0,
      activeSessionId: "",
      sessions: [],
      threads: []
    };
  }

  /**
   * @param {CampaignDocumentData} doc
   * @returns {CampaignDocumentData}
   */
  static #clone(doc) {
    return foundry.utils.duplicate(doc);
  }
}
