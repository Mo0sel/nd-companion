import { CompanionStorage } from "./storage.js";

/** @typedef {"planned"|"active"|"completed"} SessionStatus */
/** @typedef {"OPEN"|"ACTIVE"|"RESOLVED"} ThreadStatus */
/** @typedef {"MAIN"|"SIDE"|"COMPANION"} QuestCategory */
/** @typedef {"PLANNED"|"ACTIVE"|"COMPLETED"} QuestEntryStatus */

/**
 * @typedef {object} CampaignSession
 * @property {string} id
 * @property {string} title
 * @property {number} sessionNumber
 * @property {SessionStatus} status
 * @property {string} inGameDate
 * @property {string} realDate
 * @property {string} notes
 * @property {string} sessionLog
 * @property {string} createdDate
 * @property {"imported"|"live"} source
 * @property {string[]} relatedActors
 * @property {string[]} relatedLocations
 * @property {string[]} relatedItems
 * @property {string[]} relatedQuests
 * @property {string[]} relatedQuestEntries
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
 * @property {QuestCategory} category
 * @property {string} overview
 * @property {string[]} entryIds
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
 * Campaign-authored playable content. Imported copies become Playbook Beats.
 * @typedef {object} CampaignQuestEntry
 * @property {string} id
 * @property {string} questId
 * @property {string} title
 * @property {QuestEntryStatus} status
 * @property {string} speechNotes
 * @property {string} objective
 * @property {string} setup
 * @property {string} twist
 * @property {string} possibleOutcomes
 * @property {string} reward
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
 * @property {CampaignQuestEntry[]} questEntries
 */

export const CAMPAIGN_SCHEMA_VERSION = 4;

export const SESSION_STATUSES = Object.freeze(["planned", "active", "completed"]);
export const THREAD_STATUSES = Object.freeze(["OPEN", "ACTIVE", "RESOLVED"]);
export const QUEST_CATEGORIES = Object.freeze(["MAIN", "SIDE", "COMPANION"]);
export const QUEST_ENTRY_STATUSES = Object.freeze(["PLANNED", "ACTIVE", "COMPLETED"]);

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
        threads: stored?.threads,
        questEntries: stored?.questEntries,
        memoryRecords: stored?.memoryRecords
      });
      return normalized;
    }

    const sessionId = foundry.utils.randomID();
    /** @type {CampaignSession} */
    const session = {
      id: sessionId,
      title: "",
      sessionNumber: 1,
      status: "active",
      inGameDate: "",
      realDate: new Date().toISOString().slice(0, 10),
      notes,
      sessionLog: CampaignDocument.#plainText(summary),
      createdDate: new Date(now).toISOString(),
      source: "live",
      relatedActors: [],
      relatedLocations: [],
      relatedItems: [],
      relatedQuests: [],
      relatedQuestEntries: [],
      beatIds,
      created: now,
      updated: now
    };

    return CampaignDocument.#normalize({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      activeSessionId: sessionId,
      sessions: [session],
      threads: CampaignDocument.#normalizeThreads(stored?.threads),
      questEntries: CampaignDocument.#normalizeQuestEntries(stored?.questEntries),
      memoryRecords: stored?.memoryRecords
    });
  }

  /**
   * @param {unknown} stored
   * @returns {CampaignDocumentData}
   */
  static #normalize(stored) {
    const sessions = CampaignDocument.#normalizeSessions(stored?.sessions);
    const migratedMemory = CampaignDocument.#normalizeMemorySessions(stored?.memoryRecords);
    const knownIds = new Set(sessions.map((session) => session.id));
    for (const session of migratedMemory) {
      if (!knownIds.has(session.id)) sessions.push(session);
    }
    let activeSessionId =
      typeof stored?.activeSessionId === "string" ? stored.activeSessionId : "";

    if (!sessions.some(
      (session) => session.id === activeSessionId && session.status !== "completed"
    )) {
      activeSessionId = sessions.find((session) => session.status !== "completed")?.id ?? "";
    }

    return {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      activeSessionId,
      sessions,
      threads: CampaignDocument.#normalizeThreads(stored?.threads),
      questEntries: CampaignDocument.#normalizeQuestEntries(stored?.questEntries)
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
   * @param {unknown} value
   * @returns {CampaignQuestEntry[]}
   */
  static #normalizeQuestEntries(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => CampaignDocument.normalizeQuestEntry(entry));
  }

  static #normalizeMemorySessions(value) {
    if (!Array.isArray(value)) return [];
    return value.map((record) => CampaignDocument.normalizeSession({
      ...record,
      sessionLog: record?.sessionLog ?? record?.summary,
      createdDate: record?.createdDate,
      source: record?.source ?? "imported",
      status: "completed",
      relatedActors: record?.relatedActors ?? record?.relatedCharacterIds,
      relatedLocations: record?.relatedLocations ?? record?.relatedLocationIds,
      relatedItems: record?.relatedItems ?? record?.relatedItemIds,
      relatedQuests: record?.relatedQuests ?? record?.relatedQuestIds,
      relatedQuestEntries: record?.relatedQuestEntries ?? record?.relatedBeatIds
    }));
  }

  /**
   * @param {unknown} session
   * @returns {CampaignSession}
   */
  static normalizeSession(session) {
    const now = Date.now();
    const status = SESSION_STATUSES.includes(session?.status) ? session.status : "planned";
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];
    const created = Number.isFinite(session?.created) ? session.created : now;
    const legacyLog = typeof session?.summary === "string"
      ? CampaignDocument.#plainText(session.summary)
      : "";
    const createdDate = typeof session?.createdDate === "string" && session.createdDate
      ? session.createdDate
      : typeof session?.realDate === "string" && session.realDate
        ? session.realDate
        : new Date(created).toISOString();

    const normalized = {
      id: typeof session?.id === "string" && session.id ? session.id : foundry.utils.randomID(),
      title: typeof session?.title === "string" ? session.title : "",
      sessionNumber: Number.isFinite(session?.sessionNumber)
        ? Math.max(1, Math.trunc(session.sessionNumber))
        : 1,
      status,
      inGameDate: typeof session?.inGameDate === "string" ? session.inGameDate : "",
      realDate: typeof session?.realDate === "string" ? session.realDate : "",
      notes: typeof session?.notes === "string" ? session.notes : "",
      sessionLog: typeof session?.sessionLog === "string" ? session.sessionLog : legacyLog,
      createdDate,
      source: session?.source === "imported" ? "imported" : "live",
      relatedActors: idList(session?.relatedActors),
      relatedLocations: idList(session?.relatedLocations),
      relatedItems: idList(session?.relatedItems),
      relatedQuests: idList(session?.relatedQuests),
      relatedQuestEntries: idList(session?.relatedQuestEntries),
      beatIds: idList(session?.beatIds),
      created,
      updated: Number.isFinite(session?.updated) ? session.updated : now
    };
    if (session && typeof session === "object") {
      const legacyKeys = new Set([
        "summary",
        "memoryRecords",
        "relatedCharacterIds",
        "relatedLocationIds",
        "relatedItemIds",
        "relatedQuestIds",
        "relatedBeatIds"
      ]);
      for (const [key, value] of Object.entries(session)) {
        if (legacyKeys.has(key)) continue;
        if (!(key in normalized) && value !== undefined) normalized[key] = value;
      }
    }
    return normalized;
  }

  /**
   * @param {unknown} thread
   * @returns {CampaignThread}
   */
  static normalizeThread(thread) {
    const now = Date.now();
    const status = THREAD_STATUSES.includes(thread?.status) ? thread.status : "OPEN";
    const legacyCategory = String(thread?.type ?? "").toUpperCase();
    const category = QUEST_CATEGORIES.includes(thread?.category)
      ? thread.category
      : QUEST_CATEGORIES.includes(legacyCategory)
        ? legacyCategory
        : "SIDE";
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];

    return {
      id: typeof thread?.id === "string" && thread.id ? thread.id : foundry.utils.randomID(),
      title: typeof thread?.title === "string" ? thread.title : "",
      status,
      type: typeof thread?.type === "string" ? thread.type : "",
      category,
      overview:
        typeof thread?.overview === "string"
          ? thread.overview
          : typeof thread?.description === "string" && thread.description
            ? thread.description
            : typeof thread?.notes === "string"
              ? thread.notes
              : "",
      entryIds: idList(thread?.entryIds),
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

  /**
   * @param {unknown} entry
   * @returns {CampaignQuestEntry}
   */
  static normalizeQuestEntry(entry) {
    const now = Date.now();
    const status = QUEST_ENTRY_STATUSES.includes(entry?.status) ? entry.status : "PLANNED";
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];

    return {
      id: typeof entry?.id === "string" && entry.id ? entry.id : foundry.utils.randomID(),
      questId: typeof entry?.questId === "string" ? entry.questId : "",
      title: typeof entry?.title === "string" ? entry.title : "",
      status,
      speechNotes: typeof entry?.speechNotes === "string" ? entry.speechNotes : "",
      objective: typeof entry?.objective === "string" ? entry.objective : "",
      setup: typeof entry?.setup === "string" ? entry.setup : "",
      twist: typeof entry?.twist === "string" ? entry.twist : "",
      possibleOutcomes: typeof entry?.possibleOutcomes === "string" ? entry.possibleOutcomes : "",
      reward: typeof entry?.reward === "string" ? entry.reward : "",
      notes: typeof entry?.notes === "string" ? entry.notes : "",
      relatedBeatIds: idList(entry?.relatedBeatIds),
      relatedCharacterIds: idList(entry?.relatedCharacterIds),
      relatedLocationIds: idList(entry?.relatedLocationIds),
      relatedItemIds: idList(entry?.relatedItemIds),
      created: Number.isFinite(entry?.created) ? entry.created : now,
      updated: Number.isFinite(entry?.updated) ? entry.updated : now
    };
  }

  /** @returns {CampaignDocumentData} */
  static #empty() {
    return {
      schemaVersion: 0,
      activeSessionId: "",
      sessions: [],
      threads: [],
      questEntries: []
    };
  }

  static #plainText(value) {
    const container = document.createElement("div");
    container.innerHTML = String(value ?? "");
    return (container.innerText || container.textContent || "")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  /**
   * @param {CampaignDocumentData} doc
   * @returns {CampaignDocumentData}
   */
  static #clone(doc) {
    return foundry.utils.duplicate(doc);
  }
}
