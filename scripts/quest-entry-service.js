import {
  CampaignDocument,
  QUEST_ENTRY_STATUSES
} from "./campaign-document.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * Campaign-owned Story Entry CRUD.
 * The legacy class name remains as a compatibility API for existing callers.
 * Imported Session copies are created separately by PlaybookService.
 */
export class QuestEntryService {
  /** @returns {import("./campaign-document.js").CampaignQuestEntry[]} */
  static list() {
    return CampaignDocument.get().storyEntries;
  }

  /**
   * @param {string} storyThreadId
   * @returns {import("./campaign-document.js").CampaignQuestEntry[]}
   */
  static listForStoryThread(storyThreadId) {
    if (!StoryThreadService.getById(storyThreadId)) return [];
    return QuestEntryService.list().filter(
      (entry) => entry.storyThreadId === storyThreadId
    );
  }

  /**
   * Compatibility lookup for integrations that still ask by Quest.
   * @param {string} questId
   */
  static listForQuest(questId) {
    const storyIds = StoryThreadService.list()
      .filter((thread) => thread.relatedQuestIds.includes(questId))
      .map((thread) => thread.id);
    return QuestEntryService.list().filter(
      (entry) => storyIds.includes(entry.storyThreadId)
    );
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignQuestEntry|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignDocument.get().storyEntries.find((entry) => entry.id === id) ?? null;
  }

  /**
   * @param {string} storyThreadId
   * @returns {Promise<import("./campaign-document.js").CampaignQuestEntry|null>}
   */
  static async create(storyThreadId) {
    if (!StoryThreadService.getById(storyThreadId)) return null;
    const entry = CampaignDocument.normalizeQuestEntry({
      id: foundry.utils.randomID(),
      storyThreadId,
      title: "Untitled Entry",
      status: "PLANNED",
      created: Date.now(),
      updated: Date.now()
    });

    await CampaignDocument.update((doc) => {
      if (!doc.storyThreads.some((thread) => thread.id === storyThreadId)) return;
      doc.storyEntries.push(entry);
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
      const entry = doc.storyEntries.find((item) => item.id === id);
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
      const index = doc.storyEntries.findIndex((entry) => entry.id === id);
      if (index < 0) return;
      doc.storyEntries.splice(index, 1);
      removed = true;
    });
    return removed;
  }
}
