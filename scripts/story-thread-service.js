import {
  CampaignDocument,
  STORY_THREAD_STATUSES
} from "./campaign-document.js";

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
    return updated;
  }
}
