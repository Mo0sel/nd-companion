import {
  CampaignDocument,
  QUEST_CATEGORIES,
  THREAD_STATUSES
} from "./campaign-document.js";

/**
 * Lightweight narrative Threads. Independent of Sessions; refs only.
 */
export class ThreadService {
  /**
   * @returns {import("./campaign-document.js").CampaignThread[]}
   */
  static list() {
    return CampaignDocument.get().threads;
  }

  /**
   * @param {string} id
   * @returns {import("./campaign-document.js").CampaignThread|null}
   */
  static getById(id) {
    if (!id) return null;
    return CampaignDocument.get().threads.find((thread) => thread.id === id) ?? null;
  }

  /**
   * @param {{
   *   title?: string,
   *   status?: import("./campaign-document.js").ThreadStatus,
   *   type?: string,
   *   category?: import("./campaign-document.js").QuestCategory,
   *   overview?: string,
   *   description?: string,
   *   notes?: string
   * }} [seed]
   * @returns {Promise<import("./campaign-document.js").CampaignThread>}
   */
  static async create(seed = {}) {
    const thread = CampaignDocument.normalizeThread({
      id: foundry.utils.randomID(),
      title: typeof seed.title === "string" ? seed.title : "",
      status: seed.status,
      type: typeof seed.type === "string" ? seed.type : "",
      category: seed.category,
      overview: typeof seed.overview === "string" ? seed.overview : "",
      entryIds: [],
      description: typeof seed.description === "string" ? seed.description : "",
      notes: typeof seed.notes === "string" ? seed.notes : "",
      relatedBeatIds: [],
      relatedCharacterIds: [],
      relatedLocationIds: [],
      relatedItemIds: [],
      created: Date.now(),
      updated: Date.now()
    });

    await CampaignDocument.update((doc) => {
      doc.threads.push(thread);
    });

    return foundry.utils.duplicate(thread);
  }

  /**
   * @param {string} id
   * @param {{
   *   title?: string,
   *   status?: import("./campaign-document.js").ThreadStatus,
   *   type?: string,
   *   category?: import("./campaign-document.js").QuestCategory,
   *   overview?: string,
   *   description?: string,
   *   notes?: string,
   *   relatedBeatIds?: string[],
   *   relatedCharacterIds?: string[],
   *   relatedLocationIds?: string[],
   *   relatedItemIds?: string[]
   * }} patch
   * @returns {Promise<import("./campaign-document.js").CampaignThread|null>}
   */
  static async update(id, patch) {
    if (!id || !patch) return null;

    /** @type {import("./campaign-document.js").CampaignThread|null} */
    let updated = null;

    await CampaignDocument.update((doc) => {
      const thread = doc.threads.find((entry) => entry.id === id);
      if (!thread) return;

      if (typeof patch.title === "string") thread.title = patch.title;
      if (patch.status && THREAD_STATUSES.includes(patch.status)) thread.status = patch.status;
      if (typeof patch.type === "string") thread.type = patch.type;
      if (patch.category && QUEST_CATEGORIES.includes(patch.category)) {
        thread.category = patch.category;
      }
      if (typeof patch.overview === "string") thread.overview = patch.overview;
      if (typeof patch.description === "string") thread.description = patch.description;
      if (typeof patch.notes === "string") thread.notes = patch.notes;

      const assignIds = (key) => {
        if (!Array.isArray(patch[key])) return;
        thread[key] = [...new Set(patch[key].filter((value) => typeof value === "string" && value))];
      };
      assignIds("relatedBeatIds");
      assignIds("relatedCharacterIds");
      assignIds("relatedLocationIds");
      assignIds("relatedItemIds");

      thread.updated = Date.now();
      updated = foundry.utils.duplicate(thread);
    });

    return updated;
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    if (!id) return false;

    let ok = false;
    await CampaignDocument.update((doc) => {
      const index = doc.threads.findIndex((thread) => thread.id === id);
      if (index < 0) return;
      doc.threads.splice(index, 1);
      doc.questEntries = doc.questEntries.filter((entry) => entry.questId !== id);
      ok = true;
    });
    return ok;
  }
}
