import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryParser } from "./campaign-memory-parser.js";
import { EntityRegistry } from "./entity-registry.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { ThreadService } from "./thread-service.js";

/**
 * Campaign Memory — searchable historical session knowledge.
 * Not a session manager. Live PLAY sessions remain in SessionService.
 */
export class CampaignMemoryService {
  /**
   * @returns {import("./campaign-document.js").CampaignMemoryRecord[]}
   */
  static list() {
    return CampaignDocument.get().memoryRecords
      .slice()
      .sort((a, b) => b.sessionNumber - a.sessionNumber || b.updated - a.updated);
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignMemoryRecord|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignDocument.get().memoryRecords.find((record) => record.id === id) ?? null;
  }

  /**
   * Import a historical session summary into Campaign Memory.
   * Parses existing objects only; never silently creates duplicates.
   * @param {{
   *   sessionNumber: number,
   *   title?: string,
   *   summary: string
   * }} input
   * @returns {Promise<import("./campaign-document.js").CampaignMemoryRecord|null>}
   */
  static async importSession(input) {
    const sessionNumber = Number(input?.sessionNumber);
    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) return null;

    const summary = typeof input.summary === "string" ? input.summary.trim() : "";
    if (!summary) return null;

    const title = typeof input.title === "string" ? input.title.trim() : "";
    const matches = CampaignMemoryParser.parse(summary);
    const refs = await CampaignMemoryParser.resolveReferences(matches);

    const record = CampaignDocument.normalizeMemoryRecord({
      id: foundry.utils.randomID(),
      sessionNumber: Math.trunc(sessionNumber),
      title,
      summary,
      ...refs,
      created: Date.now(),
      updated: Date.now()
    });

    await CampaignDocument.update((doc) => {
      doc.memoryRecords ??= [];
      doc.memoryRecords.push(record);
    });

    return foundry.utils.duplicate(record);
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    if (!id) return false;
    let removed = false;
    await CampaignDocument.update((doc) => {
      const index = (doc.memoryRecords ?? []).findIndex((record) => record.id === id);
      if (index < 0) return;
      doc.memoryRecords.splice(index, 1);
      removed = true;
    });
    return removed;
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
      .filter((record) => (record[field] ?? []).includes(target.id))
      .map((record) => ({
        id: record.id,
        sessionNumber: record.sessionNumber,
        title: record.title?.trim() || `Session ${record.sessionNumber}`,
        label: record.title?.trim()
          ? `Session ${record.sessionNumber} · ${record.title.trim()}`
          : `Session ${record.sessionNumber}`
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
   * @param {import("./campaign-document.js").CampaignMemoryRecord} record
   * @returns {{ kind: string, id: string, name: string }[]}
   */
  static relatedLabels(record) {
    if (!record) return [];
    /** @type {{ kind: string, id: string, name: string }[]} */
    const labels = [];

    for (const id of record.relatedCharacterIds ?? []) {
      labels.push({
        kind: "actor",
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      });
    }
    for (const id of record.relatedQuestIds ?? []) {
      labels.push({
        kind: "quest",
        id,
        name: ThreadService.getById(id)?.title?.trim() || id
      });
    }
    for (const id of record.relatedBeatIds ?? []) {
      labels.push({
        kind: "beat",
        id,
        name: QuestEntryService.getById(id)?.title?.trim() || id
      });
    }
    for (const id of record.relatedLocationIds ?? []) {
      labels.push({
        kind: "scene",
        id,
        name: EntityRegistry.findByUUID(id)?.name ?? id
      });
    }
    for (const id of record.relatedItemIds ?? []) {
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
   * @returns {keyof import("./campaign-document.js").CampaignMemoryRecord|null}
   */
  static #fieldForKind(kind) {
    switch (kind) {
      case "actor":
        return "relatedCharacterIds";
      case "quest":
        return "relatedQuestIds";
      case "beat":
        return "relatedBeatIds";
      case "scene":
        return "relatedLocationIds";
      case "item":
        return "relatedItemIds";
      default:
        return null;
    }
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
