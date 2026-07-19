import { CompanionStorage } from "./storage.js";

/** @typedef {"planned"|"active"|"completed"} SessionStatus */
/** @typedef {"OPEN"|"ACTIVE"|"RESOLVED"} ThreadStatus */
/** @typedef {"MAIN"|"SIDE"|"COMPANION"} QuestCategory */
/** @typedef {"PLANNED"|"ACTIVE"|"COMPLETED"} QuestEntryStatus */
/** @typedef {"ACTIVE"|"DORMANT"|"RESOLVED"|"HIDDEN"} StoryThreadStatus */
/** @typedef {"ALLIED"|"FRIENDLY"|"NEUTRAL"|"DISTRUSTED"|"HOSTILE"|"HUNTED"} FactionReputation */

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
 * Campaign-authored playable content owned by a Story Thread.
 * Imported copies become Playbook Beats.
 * @typedef {object} CampaignQuestEntry
 * @property {string} id
 * @property {string} storyThreadId
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
 * Long-running narrative arc. Relationships are authored through mentions and
 * stored once on the Story Thread.
 * @typedef {object} CampaignStoryThread
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {StoryThreadStatus} status
 * @property {string} currentState
 * @property {string[]} openQuestions
 * @property {string[]} relatedActorIds
 * @property {string[]} relatedLocationIds
 * @property {string[]} relatedItemIds
 * @property {string[]} relatedQuestIds
 * @property {string[]} relatedSessionIds
 * @property {number} created
 * @property {number} updated
 */

/**
 * GM-authored political organization.
 * @typedef {object} CampaignFaction
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} description
 * @property {string} currentStatus
 * @property {string[]} currentObjectives
 * @property {string} resources
 * @property {FactionReputation} playerReputation
 * @property {string[]} leadershipActorIds
 * @property {string[]} relatedActorIds
 * @property {string[]} relatedStoryThreadIds
 * @property {string[]} relatedItemIds
 * @property {string[]} relatedLocationIds
 * @property {string[]} relatedQuestIds
 * @property {string[]} relatedSessionIds
 * @property {string[]} relatedFactionIds
 * @property {number} created
 * @property {number} updated
 */

/**
 * @typedef {object} CampaignDocumentData
 * @property {number} schemaVersion
 * @property {string} activeSessionId
 * @property {CampaignSession[]} sessions
 * @property {CampaignThread[]} threads
 * @property {CampaignQuestEntry[]} storyEntries
 * @property {CampaignStoryThread[]} storyThreads
 * @property {CampaignFaction[]} factions
 */

export const CAMPAIGN_SCHEMA_VERSION = 5;

export const SESSION_STATUSES = Object.freeze(["planned", "active", "completed"]);
export const THREAD_STATUSES = Object.freeze(["OPEN", "ACTIVE", "RESOLVED"]);
export const QUEST_CATEGORIES = Object.freeze(["MAIN", "SIDE", "COMPANION"]);
export const QUEST_ENTRY_STATUSES = Object.freeze(["PLANNED", "ACTIVE", "COMPLETED"]);
export const STORY_THREAD_STATUSES = Object.freeze(["ACTIVE", "DORMANT", "RESOLVED", "HIDDEN"]);
export const FACTION_REPUTATIONS = Object.freeze([
  "ALLIED",
  "FRIENDLY",
  "NEUTRAL",
  "DISTRUSTED",
  "HOSTILE",
  "HUNTED"
]);

/**
 * In-memory campaign document (sessions + threads).
 * Single write path for SessionService and ThreadService.
 */
export class CampaignDocument {
  /** @type {CampaignDocumentData} */
  static #doc = CampaignDocument.#empty();

  /** @type {boolean} */
  static #ready = false;

  /** @type {number} */
  static #revision = 0;

  /** @returns {boolean} */
  static get isReady() {
    return CampaignDocument.#ready;
  }

  /** @returns {number} In-memory relationship graph revision. */
  static get revision() {
    return CampaignDocument.#revision;
  }

  /**
   * Load or migrate the campaign document. Call after PlaybookService.ready().
   * @returns {Promise<void>}
   */
  static async ready() {
    const stored = CompanionStorage.getCampaign();
    const previousVersion = Number.isFinite(stored?.schemaVersion)
      ? stored.schemaVersion
      : 0;
    const needsMigration =
      !stored ||
      typeof stored !== "object" ||
      !Number.isFinite(stored.schemaVersion) ||
      stored.schemaVersion < CAMPAIGN_SCHEMA_VERSION;

    // Auto-create Story Threads only during migration. Re-running creation on
    // every normalize would mint new random IDs for orphaned entries.
    CampaignDocument.#doc = needsMigration
      ? CampaignDocument.#migrateFromLegacy(stored)
      : CampaignDocument.#normalize(stored, { allowCreateOwners: false });

    if (needsMigration || CampaignDocument.#doc.schemaVersion !== previousVersion) {
      await CompanionStorage.setCampaign(CampaignDocument.#doc);
      if (needsMigration) await CompanionStorage.clearLegacySessionFields();
    }

    CampaignDocument.#ready = true;
    CampaignDocument.#revision += 1;
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
    CampaignDocument.#revision += 1;
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
      return CampaignDocument.#normalize({
        schemaVersion: stored?.schemaVersion,
        activeSessionId: stored?.activeSessionId,
        sessions: existingSessions,
        threads: stored?.threads,
        storyEntries: stored?.storyEntries ?? stored?.questEntries,
        storyThreads: stored?.storyThreads,
        factions: stored?.factions,
        memoryRecords: stored?.memoryRecords
      }, { allowCreateOwners: true });
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
      schemaVersion: stored?.schemaVersion,
      activeSessionId: sessionId,
      sessions: [session],
      threads: stored?.threads,
      storyEntries: stored?.storyEntries ?? stored?.questEntries,
      storyThreads: stored?.storyThreads,
      factions: stored?.factions,
      memoryRecords: stored?.memoryRecords
    }, { allowCreateOwners: true });
  }

  /**
   * @param {unknown} stored
   * @param {{ allowCreateOwners?: boolean }} [options]
   * @returns {CampaignDocumentData}
   */
  static #normalize(stored, options = {}) {
    const allowCreateOwners = options.allowCreateOwners !== false;
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

    const threads = CampaignDocument.#normalizeThreads(stored?.threads);
    const storyThreads = CampaignDocument.#normalizeStoryThreads(stored?.storyThreads);
    const rawEntries = Array.isArray(stored?.storyEntries)
      ? stored.storyEntries
      : Array.isArray(stored?.questEntries) ? stored.questEntries : [];
    const legacyQuestByEntry = CampaignDocument.#legacyQuestOwners(
      stored?.threads,
      rawEntries
    );
    const storyEntries = rawEntries.map((entry) =>
      CampaignDocument.normalizeQuestEntry(entry)
    );
    CampaignDocument.#assignStoryEntryOwners({
      entries: storyEntries,
      rawEntries,
      threads,
      storyThreads,
      legacyQuestByEntry,
      allowCreateOwners
    });

    return {
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      activeSessionId,
      sessions,
      threads,
      storyEntries,
      storyThreads,
      factions: CampaignDocument.#normalizeFactions(stored?.factions)
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

  static #legacyQuestOwners(rawThreads, rawEntries) {
    const owners = new Map();
    for (const entry of Array.isArray(rawEntries) ? rawEntries : []) {
      if (typeof entry?.id === "string" && typeof entry?.questId === "string") {
        owners.set(entry.id, entry.questId);
      }
    }
    for (const quest of Array.isArray(rawThreads) ? rawThreads : []) {
      if (typeof quest?.id !== "string" || !Array.isArray(quest?.entryIds)) continue;
      for (const entryId of quest.entryIds) {
        if (typeof entryId === "string" && !owners.has(entryId)) {
          owners.set(entryId, quest.id);
        }
      }
    }
    return owners;
  }

  static #assignStoryEntryOwners({
    entries,
    rawEntries,
    threads,
    storyThreads,
    legacyQuestByEntry,
    allowCreateOwners = true
  }) {
    const storyIds = new Set(storyThreads.map((thread) => thread.id));
    const questsById = new Map(threads.map((quest) => [quest.id, quest]));
    const rawById = new Map(
      rawEntries
        .filter((entry) => typeof entry?.id === "string")
        .map((entry) => [entry.id, entry])
    );
    const generatedByQuest = new Map();

    for (const entry of entries) {
      if (entry.storyThreadId && storyIds.has(entry.storyThreadId)) continue;
      const raw = rawById.get(entry.id);
      const questId = typeof raw?.questId === "string"
        ? raw.questId
        : legacyQuestByEntry.get(entry.id) ?? "";
      let owner = storyThreads.find(
        (thread) => questId && thread.relatedQuestIds.includes(questId)
      );
      if (!owner && questId) owner = generatedByQuest.get(questId);
      if (!owner && allowCreateOwners) {
        const quest = questsById.get(questId);
        owner = CampaignDocument.normalizeStoryThread({
          id: foundry.utils.randomID(),
          title: quest?.title?.trim() || entry.title?.trim() || "Untitled Story Thread",
          status: quest?.status === "RESOLVED" ? "RESOLVED" : "ACTIVE",
          relatedQuestIds: quest ? [quest.id] : [],
          created: entry.created,
          updated: entry.updated
        });
        storyThreads.push(owner);
        storyIds.add(owner.id);
        if (questId) generatedByQuest.set(questId, owner);
      }
      if (owner) entry.storyThreadId = owner.id;
    }
  }

  /**
   * @param {unknown} value
   * @returns {CampaignStoryThread[]}
   */
  static #normalizeStoryThreads(value) {
    if (!Array.isArray(value)) return [];
    return value.map((thread) => CampaignDocument.normalizeStoryThread(thread));
  }

  /**
   * @param {unknown} value
   * @returns {CampaignFaction[]}
   */
  static #normalizeFactions(value) {
    if (!Array.isArray(value)) return [];
    return value.map((faction) => CampaignDocument.normalizeFaction(faction));
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
      storyThreadId:
        typeof entry?.storyThreadId === "string" ? entry.storyThreadId : "",
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

  /**
   * @param {unknown} thread
   * @returns {CampaignStoryThread}
   */
  static normalizeStoryThread(thread) {
    const now = Date.now();
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];
    return {
      id: typeof thread?.id === "string" && thread.id
        ? thread.id
        : foundry.utils.randomID(),
      title: typeof thread?.title === "string" ? thread.title : "",
      description: typeof thread?.description === "string" ? thread.description : "",
      status: STORY_THREAD_STATUSES.includes(thread?.status) ? thread.status : "ACTIVE",
      currentState: typeof thread?.currentState === "string" ? thread.currentState : "",
      openQuestions: Array.isArray(thread?.openQuestions)
        ? thread.openQuestions.filter((question) => typeof question === "string")
        : [],
      relatedActorIds: idList(thread?.relatedActorIds),
      relatedLocationIds: idList(thread?.relatedLocationIds),
      relatedItemIds: idList(thread?.relatedItemIds),
      relatedQuestIds: idList(thread?.relatedQuestIds),
      relatedSessionIds: idList(thread?.relatedSessionIds),
      created: Number.isFinite(thread?.created) ? thread.created : now,
      updated: Number.isFinite(thread?.updated) ? thread.updated : now
    };
  }

  /**
   * @param {unknown} faction
   * @returns {CampaignFaction}
   */
  static normalizeFaction(faction) {
    const now = Date.now();
    const idList = (value) =>
      Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === "string" && id))]
        : [];
    return {
      id: typeof faction?.id === "string" && faction.id
        ? faction.id
        : foundry.utils.randomID(),
      name: typeof faction?.name === "string" ? faction.name : "",
      icon: typeof faction?.icon === "string" ? faction.icon : "",
      description: typeof faction?.description === "string" ? faction.description : "",
      currentStatus: typeof faction?.currentStatus === "string" ? faction.currentStatus : "",
      currentObjectives: Array.isArray(faction?.currentObjectives)
        ? faction.currentObjectives.filter((objective) => typeof objective === "string")
        : [],
      resources: typeof faction?.resources === "string" ? faction.resources : "",
      playerReputation: FACTION_REPUTATIONS.includes(faction?.playerReputation)
        ? faction.playerReputation
        : "NEUTRAL",
      leadershipActorIds: idList(faction?.leadershipActorIds),
      relatedActorIds: idList(faction?.relatedActorIds),
      relatedStoryThreadIds: idList(faction?.relatedStoryThreadIds),
      relatedItemIds: idList(faction?.relatedItemIds),
      relatedLocationIds: idList(faction?.relatedLocationIds),
      relatedQuestIds: idList(faction?.relatedQuestIds),
      relatedSessionIds: idList(faction?.relatedSessionIds),
      relatedFactionIds: idList(faction?.relatedFactionIds),
      created: Number.isFinite(faction?.created) ? faction.created : now,
      updated: Number.isFinite(faction?.updated) ? faction.updated : now
    };
  }

  /** @returns {CampaignDocumentData} */
  static #empty() {
    return {
      schemaVersion: 0,
      activeSessionId: "",
      sessions: [],
      threads: [],
      storyEntries: [],
      storyThreads: [],
      factions: []
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
