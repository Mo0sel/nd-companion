import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryParser } from "./campaign-memory-parser.js";
import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { RichText } from "./rich-text.js";
import { ThreadService } from "./thread-service.js";

/**
 * Chronicle queries and imports over the canonical Session collection.
 * Live session lifecycle remains owned by SessionService.
 */
export class CampaignMemoryService {
  static label(session) {
    if (!session) return "Session";
    const base = `Session ${session.sessionNumber}`;
    const title = session.title?.trim() ?? "";
    return title && title.toLocaleLowerCase() !== base.toLocaleLowerCase()
      ? `${base} · ${title}`
      : base;
  }

  /**
   * Archived sessions, newest first.
   * @returns {import("./campaign-document.js").CampaignSession[]}
   */
  static list() {
    const activeId = CampaignDocument.get().activeSessionId;
    return CampaignDocument.get().sessions
      .filter((session) => session.id !== activeId && session.status === "completed")
      .slice()
      .sort((a, b) => b.sessionNumber - a.sessionNumber || b.updated - a.updated);
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignSession|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignMemoryService.list().find((session) => session.id === id) ?? null;
  }

  /**
   * Import a historical session summary into Campaign Memory.
   * Parses existing objects only; never silently creates duplicates.
   * @param {{
   *   sessionNumber: number,
   *   title?: string,
   *   sessionLog: string
   * }} input
   * @returns {Promise<{ ok: true, session: import("./campaign-document.js").CampaignSession }|{ ok: false, reason: "invalid"|"duplicate" }>}
   */
  static async importSession(input) {
    const sessionNumber = Number(input?.sessionNumber);
    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) {
      return { ok: false, reason: "invalid" };
    }

    const sessionLog = typeof input.sessionLog === "string" ? input.sessionLog.trim() : "";
    if (!sessionLog) return { ok: false, reason: "invalid" };
    if (CampaignDocument.get().sessions.some(
      (session) => session.sessionNumber === Math.trunc(sessionNumber)
    )) {
      return { ok: false, reason: "duplicate" };
    }

    const title = typeof input.title === "string" ? input.title.trim() : "";
    const matches = CampaignMemoryParser.parse(sessionLog);
    const refs = await CampaignMemoryParser.resolveReferences(matches);

    const session = CampaignDocument.normalizeSession({
      id: foundry.utils.randomID(),
      sessionNumber: Math.trunc(sessionNumber),
      title,
      sessionLog,
      source: "imported",
      status: "completed",
      createdDate: new Date().toISOString(),
      ...CampaignMemoryService.#sessionRefs(refs),
      created: Date.now(),
      updated: Date.now()
    });

    await CampaignDocument.update((doc) => {
      doc.sessions.push(session);
    });

    return { ok: true, session: foundry.utils.duplicate(session) };
  }

  /**
   * Edit the canonical log and recompute every inferred relationship.
   * Sanitizes HTML, extracts EntityMentions, and merges name-based matches.
   * @param {string} id
   * @param {string} sessionLog
   * @returns {Promise<import("./campaign-document.js").CampaignSession|null>}
   */
  static async updateSessionLog(id, sessionLog) {
    const current = CampaignMemoryService.getById(id);
    if (!current) return null;
    const value = RichText.sanitize(String(sessionLog ?? ""));
    const mentionRefs = CampaignMemoryService.#refsFromMentions(
      EntityMentions.extract(value)
    );
    const parserRefs = await CampaignMemoryParser.resolveReferences(
      CampaignMemoryParser.parse(RichText.plainText(value))
    );
    const refs = CampaignMemoryService.#mergeRefs(mentionRefs, parserRefs);
    let updated = null;
    await CampaignDocument.update((doc) => {
      const session = doc.sessions.find((entry) => entry.id === id);
      if (!session) return;
      session.sessionLog = value;
      Object.assign(session, CampaignMemoryService.#sessionRefs(refs));
      session.updated = Date.now();
      updated = foundry.utils.duplicate(session);
    });
    return updated;
  }

  /**
   * Computed history for an Actor, Quest, Quest Entry, Location, or Item.
   * Scans stored memory references only — no duplicated reverse index.
   * @param {{
   *   kind: "actor"|"quest"|"beat"|"scene"|"item",
   *   id: string
   * }} target
   * @returns {ObjectHistory}
   */
  static historyFor(target) {
    const empty = {
      firstAppearance: null,
      lastAppearance: null,
      appearsIn: [],
      mentionCount: 0
    };
    if (!target?.kind || !target?.id) return empty;

    const field = CampaignMemoryService.#fieldForKind(target.kind);
    if (!field) return empty;

    const appearsIn = CampaignMemoryService.list()
      .filter((session) => (session[field] ?? []).includes(target.id))
      .map((session) => ({
        id: session.id,
        sessionNumber: session.sessionNumber,
        title: CampaignMemoryService.label(session),
        label: CampaignMemoryService.label(session)
      }))
      .sort((a, b) => a.sessionNumber - b.sessionNumber);

    if (!appearsIn.length) return empty;

    return {
      firstAppearance: appearsIn[0],
      lastAppearance: appearsIn[appearsIn.length - 1],
      appearsIn,
      mentionCount: appearsIn.length
    };
  }

  /**
   * Resolve display labels for related IDs on a memory record.
   * @param {import("./campaign-document.js").CampaignSession} record
   * @returns {{ kind: string, id: string, name: string }[]}
   */
  static relatedLabels(record) {
    if (!record) return [];
    /** @type {{ kind: string, id: string, name: string }[]} */
    const labels = [];

    for (const id of record.relatedActors ?? []) {
      labels.push({
        kind: "actor",
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      });
    }
    for (const id of record.relatedQuests ?? []) {
      labels.push({
        kind: "quest",
        id,
        name: ThreadService.getById(id)?.title?.trim() || id
      });
    }
    for (const id of record.relatedQuestEntries ?? []) {
      labels.push({
        kind: "beat",
        id,
        name: QuestEntryService.getById(id)?.title?.trim() || id
      });
    }
    for (const id of record.relatedLocations ?? []) {
      labels.push({
        kind: "scene",
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      });
    }
    for (const id of record.relatedItems ?? []) {
      labels.push({
        kind: "item",
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      });
    }
    return labels;
  }

  /**
   * @param {string} kind
   * @returns {keyof import("./campaign-document.js").CampaignSession|null}
   */
  static #fieldForKind(kind) {
    switch (kind) {
      case "actor":
        return "relatedActors";
      case "quest":
        return "relatedQuests";
      case "beat":
        return "relatedQuestEntries";
      case "scene":
        return "relatedLocations";
      case "item":
        return "relatedItems";
      default:
        return null;
    }
  }

  static #sessionRefs(refs) {
    return {
      relatedActors: refs.relatedCharacterIds ?? [],
      relatedLocations: refs.relatedLocationIds ?? [],
      relatedItems: refs.relatedItemIds ?? [],
      relatedQuests: refs.relatedQuestIds ?? [],
      relatedQuestEntries: refs.relatedBeatIds ?? []
    };
  }

  /**
   * Same mention → related* mapping used by Quest Overview / Quest Entries.
   * @param {import("./entity-mentions.js").MentionReference[]} mentions
   */
  static #refsFromMentions(mentions) {
    const ids = (kind, preferUuid) =>
      (mentions ?? [])
        .filter((mention) => mention.kind === kind)
        .map((mention) => (preferUuid ? mention.uuid : mention.id) || mention.id)
        .filter(Boolean);
    return {
      relatedBeatIds: ids("beat", false),
      relatedCharacterIds: ids("actor", true),
      relatedLocationIds: ids("scene", true),
      relatedItemIds: ids("item", true),
      relatedQuestIds: ids("quest", false)
    };
  }

  /**
   * @param {ReturnType<typeof CampaignMemoryService.#refsFromMentions>} a
   * @param {Awaited<ReturnType<typeof CampaignMemoryParser.resolveReferences>>} b
   */
  static #mergeRefs(a, b) {
    const union = (left, right) => [...new Set([...(left ?? []), ...(right ?? [])])];
    return {
      relatedBeatIds: union(a.relatedBeatIds, b.relatedBeatIds),
      relatedCharacterIds: union(a.relatedCharacterIds, b.relatedCharacterIds),
      relatedLocationIds: union(a.relatedLocationIds, b.relatedLocationIds),
      relatedItemIds: union(a.relatedItemIds, b.relatedItemIds),
      relatedQuestIds: union(a.relatedQuestIds, b.relatedQuestIds)
    };
  }
}

/**
 * @typedef {object} ObjectHistoryAppearance
 * @property {string} id
 * @property {number} sessionNumber
 * @property {string} title
 * @property {string} label
 */

/**
 * @typedef {object} ObjectHistory
 * @property {ObjectHistoryAppearance|null} firstAppearance
 * @property {ObjectHistoryAppearance|null} lastAppearance
 * @property {ObjectHistoryAppearance[]} appearsIn
 * @property {number} mentionCount
 */
