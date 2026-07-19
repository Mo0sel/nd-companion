import { CampaignDocument, SESSION_STATUSES } from "./campaign-document.js";
import { CampaignMemoryParser } from "./campaign-memory-parser.js";
import { CompanionStorage } from "./storage.js";

/**
 * Session CRUD and active-session accessors.
 * Beats remain in PlaybookService; ownership is Session.beatIds only.
 */
export class SessionService {
  /**
   * Wire Live Notes session keys to the active Session after campaign ready.
   * Re-sync beat ownership from the current playbook.
   * @returns {Promise<void>}
   */
  static async ready() {
    CompanionStorage.setSessionBridge({
      getNotes: () => SessionService.getActiveNotes(),
      setNotes: (value) => SessionService.setActiveNotes(value),
      getSummary: () => SessionService.getActiveSessionLog(),
      setSummary: (value) => SessionService.setActiveSessionLog(value),
      getLog: () => SessionService.getActiveSessionLog(),
      setLog: (value) => SessionService.setActiveSessionLog(value)
    });

    const playbook = CompanionStorage.getPlaybook();
    const beatIds = Array.isArray(playbook?.beats)
      ? playbook.beats
          .map((beat) => (typeof beat?.id === "string" ? beat.id : ""))
          .filter(Boolean)
      : [];
    await SessionService.syncActiveBeatIds(beatIds);
  }

  /**
   * @returns {import("./campaign-document.js").CampaignSession|null}
   */
  static getActive() {
    const doc = CampaignDocument.get();
    if (!doc.activeSessionId) return null;
    return doc.sessions.find((session) => session.id === doc.activeSessionId) ?? null;
  }

  /**
   * @returns {import("./campaign-document.js").CampaignSession[]}
   */
  static list() {
    return CampaignDocument.get().sessions;
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignSession|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignDocument.get().sessions.find((session) => session.id === id) ?? null;
  }

  /**
   * Select a non-archived Session as the live working Session.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async setActive(id) {
    const selected = SessionService.getById(id);
    if (!selected || selected.status === "completed") return false;
    await CampaignDocument.update((doc) => {
      for (const session of doc.sessions) {
        if (session.id === id) {
          session.status = "active";
          session.updated = Date.now();
        } else if (session.status === "active") {
          session.status = "planned";
          session.updated = Date.now();
        }
      }
      doc.activeSessionId = id;
    });
    return true;
  }

  /**
   * Notes for the active session (Live Notes compatibility).
   * @returns {string}
   */
  static getActiveNotes() {
    return SessionService.getActive()?.notes ?? "";
  }

  /**
   * @param {string} value
   * @returns {Promise<string>}
   */
  static async setActiveNotes(value) {
    const notes = value ?? "";
    await SessionService.#patchActive({ notes });
    return notes;
  }

  /**
   * Canonical Session Log for the active session.
   * @returns {string}
   */
  static getActiveSessionLog() {
    return SessionService.getActive()?.sessionLog ?? "";
  }

  /**
   * @param {string} value
   * @returns {Promise<string>}
   */
  static async setActiveSessionLog(value) {
    const sessionLog = value ?? "";
    await SessionService.#patchActive({ sessionLog });
    return sessionLog;
  }

  // Compatibility for callers using the pre-Chronicle method names.
  static getActiveSummary() {
    return SessionService.getActiveSessionLog();
  }

  static setActiveSummary(value) {
    return SessionService.setActiveSessionLog(value);
  }

  /**
   * Finalize the current live session and create the next empty live session.
   * @returns {Promise<{ archived: import("./campaign-document.js").CampaignSession, next: import("./campaign-document.js").CampaignSession }|null>}
   */
  static async endActiveSession() {
    const active = SessionService.getActive();
    if (!active) return null;

    const refs = await CampaignMemoryParser.resolveReferences(
      CampaignMemoryParser.parse(active.sessionLog)
    );
    const now = Date.now();
    const nextNumber = active.sessionNumber + 1;
    const next = CampaignDocument.normalizeSession({
      id: foundry.utils.randomID(),
      sessionNumber: nextNumber,
      title: "",
      sessionLog: "",
      notes: "",
      status: "active",
      source: "live",
      createdDate: new Date(now).toISOString(),
      beatIds: [],
      created: now,
      updated: now
    });
    let archived = null;

    await CampaignDocument.update((doc) => {
      const session = doc.sessions.find((entry) => entry.id === doc.activeSessionId);
      if (!session) return;
      session.status = "completed";
      session.source = "live";
      session.relatedActors = refs.relatedCharacterIds ?? [];
      session.relatedLocations = refs.relatedLocationIds ?? [];
      session.relatedItems = refs.relatedItemIds ?? [];
      session.relatedQuests = refs.relatedQuestIds ?? [];
      session.relatedQuestEntries = refs.relatedBeatIds ?? [];
      session.updated = now;
      archived = foundry.utils.duplicate(session);
      doc.sessions.push(next);
      doc.activeSessionId = next.id;
    });

    return archived ? { archived, next: foundry.utils.duplicate(next) } : null;
  }

  /**
   * Replace beat ownership on the active session (playbook order).
   * @param {string[]} beatIds
   * @returns {Promise<boolean>}
   */
  static async syncActiveBeatIds(beatIds) {
    const ids = Array.isArray(beatIds)
      ? [...new Set(beatIds.filter((id) => typeof id === "string" && id))]
      : [];
    return SessionService.#patchActive({ beatIds: ids });
  }

  /**
   * @param {Partial<import("./campaign-document.js").CampaignSession>} patch
   * @returns {Promise<boolean>}
   */
  static async #patchActive(patch) {
    if (!CampaignDocument.isReady) return false;

    let ok = false;
    await CampaignDocument.update((doc) => {
      const session = doc.sessions.find((entry) => entry.id === doc.activeSessionId);
      if (!session) return;

      if (typeof patch.title === "string") session.title = patch.title;
      if (Number.isFinite(patch.sessionNumber)) {
        session.sessionNumber = Math.max(1, Math.trunc(patch.sessionNumber));
      }
      if (patch.status && SESSION_STATUSES.includes(patch.status)) {
        session.status = patch.status;
      }
      if (typeof patch.inGameDate === "string") session.inGameDate = patch.inGameDate;
      if (typeof patch.realDate === "string") session.realDate = patch.realDate;
      if (typeof patch.notes === "string") session.notes = patch.notes;
      if (typeof patch.sessionLog === "string") session.sessionLog = patch.sessionLog;
      if (Array.isArray(patch.beatIds)) {
        session.beatIds = [...new Set(patch.beatIds.filter((id) => typeof id === "string" && id))];
      }
      session.updated = Date.now();
      ok = true;
    });
    return ok;
  }
}
