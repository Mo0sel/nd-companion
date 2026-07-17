import {
  CampaignDocument,
  QUEST_ENTRY_STATUSES
} from "./campaign-document.js";
import { ThreadService } from "./thread-service.js";

/**
 * Campaign-owned Quest Entry CRUD.
 * Imported Session copies are created separately by PlaybookService.
 */
export class QuestEntryService {
  /** @returns {import("./campaign-document.js").CampaignQuestEntry[]} */
  static list() {
    return CampaignDocument.get().questEntries;
  }

  /**
   * @param {string} questId
   * @returns {import("./campaign-document.js").CampaignQuestEntry[]}
   */
  static listForQuest(questId) {
    const doc = CampaignDocument.get();
    const quest = doc.threads.find((thread) => thread.id === questId);
    if (!quest) return [];
    const byId = new Map(doc.questEntries.map((entry) => [entry.id, entry]));
    return (quest.entryIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignQuestEntry|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignDocument.get().questEntries.find((entry) => entry.id === id) ?? null;
  }

  /**
   * @param {string} questId
   * @returns {Promise<import("./campaign-document.js").CampaignQuestEntry|null>}
   */
  static async create(questId) {
    if (!ThreadService.getById(questId)) return null;
    const entry = CampaignDocument.normalizeQuestEntry({
      id: foundry.utils.randomID(),
      questId,
      title: "Untitled Entry",
      status: "PLANNED",
      created: Date.now(),
      updated: Date.now()
    });

    await CampaignDocument.update((doc) => {
      const quest = doc.threads.find((thread) => thread.id === questId);
      if (!quest) return;
      doc.questEntries.push(entry);
      quest.entryIds ??= [];
      quest.entryIds.push(entry.id);
      quest.updated = Date.now();
    });
    return foundry.utils.duplicate(entry);
  }

  /**
   * @param {string} id
   * @param {Partial<import("./campaign-document.js").CampaignQuestEntry>} patch
   * @returns {Promise<import("./campaign-document.js").CampaignQuestEntry|null>}
   */
  static async update(id, patch) {
    if (!id || !patch) return null;
    let updated = null;
    await CampaignDocument.update((doc) => {
      const entry = doc.questEntries.find((item) => item.id === id);
      if (!entry) return;

      if (typeof patch.title === "string") entry.title = patch.title;
      if (patch.status && QUEST_ENTRY_STATUSES.includes(patch.status)) entry.status = patch.status;
      for (const field of [
        "speechNotes",
        "objective",
        "setup",
        "twist",
        "possibleOutcomes",
        "reward",
        "notes"
      ]) {
        if (typeof patch[field] === "string") entry[field] = patch[field];
      }
      for (const field of [
        "relatedBeatIds",
        "relatedCharacterIds",
        "relatedLocationIds",
        "relatedItemIds"
      ]) {
        if (Array.isArray(patch[field])) {
          entry[field] = [...new Set(patch[field].filter((value) => typeof value === "string" && value))];
        }
      }
      entry.updated = Date.now();
      updated = foundry.utils.duplicate(entry);
    });
    return updated;
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    if (!id) return false;
    let removed = false;
    await CampaignDocument.update((doc) => {
      const index = doc.questEntries.findIndex((entry) => entry.id === id);
      if (index < 0) return;
      const [entry] = doc.questEntries.splice(index, 1);
      const quest = doc.threads.find((thread) => thread.id === entry.questId);
      if (quest) {
        quest.entryIds = (quest.entryIds ?? []).filter((entryId) => entryId !== id);
        quest.updated = Date.now();
      }
      removed = true;
    });
    return removed;
  }
}
