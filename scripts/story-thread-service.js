import {
  CampaignDocument,
  STORY_THREAD_STATUSES
} from "./campaign-document.js";
import { PlaybookService } from "./playbook-service.js";

/**
 * CRUD facade for long-running narrative arcs stored in CampaignDocument.
 */
export class StoryThreadService {
  /** @returns {import("./campaign-document.js").CampaignStoryThread[]} */
  static list() {
    return CampaignDocument.get().storyThreads;
  }

  /** @param {string} id */
  static getById(id) {
    if (!id) return null;
    return StoryThreadService.list().find((thread) => thread.id === id) ?? null;
  }

  /**
   * @param {Partial<import("./campaign-document.js").CampaignStoryThread>} [seed]
   */
  static async create(seed = {}) {
    const thread = CampaignDocument.normalizeStoryThread({
      id: foundry.utils.randomID(),
      title: typeof seed.title === "string" ? seed.title : "",
      description: typeof seed.description === "string" ? seed.description : "",
      status: seed.status,
      currentState: typeof seed.currentState === "string" ? seed.currentState : "",
      openQuestions: Array.isArray(seed.openQuestions) ? seed.openQuestions : [],
      relatedActorIds: [],
      relatedLocationIds: [],
      relatedItemIds: [],
      relatedQuestIds: [],
      relatedSessionIds: [],
      created: Date.now(),
      updated: Date.now()
    });
    await CampaignDocument.update((doc) => {
      doc.storyThreads.push(thread);
    });
    const { CampaignActivityService } = await import("./campaign-activity-service.js");
    CampaignActivityService.created(
      "storyThread",
      thread.id,
      thread.title?.trim() || "Untitled Story Thread"
    );
    return foundry.utils.duplicate(thread);
  }

  /**
   * @param {string} id
   * @param {Partial<import("./campaign-document.js").CampaignStoryThread>} patch
   */
  static async update(id, patch) {
    if (!id || !patch) return null;
    let updated = null;
    await CampaignDocument.update((doc) => {
      const thread = doc.storyThreads.find((entry) => entry.id === id);
      if (!thread) return;
      if (typeof patch.title === "string") thread.title = patch.title;
      if (typeof patch.description === "string") thread.description = patch.description;
      if (STORY_THREAD_STATUSES.includes(patch.status)) thread.status = patch.status;
      if (typeof patch.currentState === "string") thread.currentState = patch.currentState;
      if (Array.isArray(patch.openQuestions)) {
        thread.openQuestions = patch.openQuestions.filter(
          (question) => typeof question === "string"
        );
      }
      for (const key of [
        "relatedActorIds",
        "relatedLocationIds",
        "relatedItemIds",
        "relatedQuestIds",
        "relatedSessionIds"
      ]) {
        if (!Array.isArray(patch[key])) continue;
        thread[key] = [...new Set(
          patch[key].filter((value) => typeof value === "string" && value)
        )];
      }
      thread.updated = Date.now();
      updated = foundry.utils.duplicate(thread);
    });
    if (updated) {
      const { CampaignActivityService } = await import("./campaign-activity-service.js");
      CampaignActivityService.edited(
        "storyThread",
        id,
        updated.title,
        CampaignActivityService.patchFieldLabel(patch, {
          title: "Title",
          description: "Description",
          status: "Status",
          currentState: "Current State",
          openQuestions: "Open Questions"
        })
      );
    }
    return updated;
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    if (!id) return false;
    const existing = StoryThreadService.getById(id);
    let removed = false;
    let questIds = [];
    await CampaignDocument.update((doc) => {
      const index = doc.storyThreads.findIndex((thread) => thread.id === id);
      if (index < 0) return;
      doc.storyThreads.splice(index, 1);
      questIds = doc.storyEntries
        .filter((entry) => entry.storyThreadId === id)
        .map((entry) => entry.id);
      const deleted = new Set(questIds);
      doc.storyEntries = doc.storyEntries.filter(
        (entry) => entry.storyThreadId !== id
      );
      for (const entry of doc.storyEntries) {
        entry.relatedBeatIds = (entry.relatedBeatIds ?? [])
          .filter((entryId) => !deleted.has(entryId));
      }
      for (const quest of doc.threads) {
        quest.relatedBeatIds = (quest.relatedBeatIds ?? [])
          .filter((entryId) => !deleted.has(entryId));
      }
      for (const session of doc.sessions) {
        session.relatedQuestEntries = (session.relatedQuestEntries ?? [])
          .filter((entryId) => !deleted.has(entryId));
      }
      for (const faction of doc.factions) {
        faction.relatedStoryThreadIds = (faction.relatedStoryThreadIds ?? [])
          .filter((threadId) => threadId !== id);
      }
      removed = true;
    });
    if (removed && questIds.length) {
      await PlaybookService.purgeSourceEntries(questIds);
    }
    if (removed && existing) {
      const { CampaignActivityService } = await import("./campaign-activity-service.js");
      CampaignActivityService.deleted(
        "storyThread",
        id,
        existing.title?.trim() || "Untitled Story Thread"
      );
    }
    return removed;
  }
}
