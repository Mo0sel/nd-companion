import {
  CampaignDocument,
  FACTION_REPUTATIONS
} from "./campaign-document.js";

/**
 * CRUD facade for GM-authored political organizations.
 */
export class FactionService {
  /** @returns {import("./campaign-document.js").CampaignFaction[]} */
  static list() {
    return CampaignDocument.get().factions;
  }

  /** @param {string} id */
  static getById(id) {
    if (!id) return null;
    return FactionService.list().find((faction) => faction.id === id) ?? null;
  }

  /** @param {Partial<import("./campaign-document.js").CampaignFaction>} [seed] */
  static async create(seed = {}) {
    const faction = CampaignDocument.normalizeFaction({
      id: foundry.utils.randomID(),
      name: typeof seed.name === "string" ? seed.name : "",
      icon: typeof seed.icon === "string" ? seed.icon : "",
      description: typeof seed.description === "string" ? seed.description : "",
      currentStatus: typeof seed.currentStatus === "string" ? seed.currentStatus : "",
      currentObjectives: Array.isArray(seed.currentObjectives)
        ? seed.currentObjectives
        : [],
      resources: typeof seed.resources === "string" ? seed.resources : "",
      playerReputation: seed.playerReputation,
      leadershipActorIds: [],
      relatedActorIds: [],
      relatedStoryThreadIds: [],
      relatedItemIds: [],
      relatedLocationIds: [],
      relatedQuestIds: [],
      relatedSessionIds: [],
      relatedFactionIds: [],
      created: Date.now(),
      updated: Date.now()
    });
    await CampaignDocument.update((doc) => {
      doc.factions.push(faction);
    });
    const { CampaignActivityService } = await import("./campaign-activity-service.js");
    CampaignActivityService.created(
      "faction",
      faction.id,
      faction.name?.trim() || "Untitled Faction"
    );
    return foundry.utils.duplicate(faction);
  }

  /**
   * @param {string} id
   * @param {Partial<import("./campaign-document.js").CampaignFaction>} patch
   */
  static async update(id, patch) {
    if (!id || !patch) return null;
    let updated = null;
    await CampaignDocument.update((doc) => {
      const faction = doc.factions.find((entry) => entry.id === id);
      if (!faction) return;
      if (typeof patch.name === "string") faction.name = patch.name;
      if (typeof patch.icon === "string") faction.icon = patch.icon;
      if (typeof patch.description === "string") faction.description = patch.description;
      if (typeof patch.currentStatus === "string") {
        faction.currentStatus = patch.currentStatus;
      }
      if (typeof patch.resources === "string") faction.resources = patch.resources;
      if (FACTION_REPUTATIONS.includes(patch.playerReputation)) {
        faction.playerReputation = patch.playerReputation;
      }
      if (Array.isArray(patch.currentObjectives)) {
        faction.currentObjectives = patch.currentObjectives.filter(
          (objective) => typeof objective === "string"
        );
      }
      for (const key of [
        "leadershipActorIds",
        "relatedActorIds",
        "relatedStoryThreadIds",
        "relatedItemIds",
        "relatedLocationIds",
        "relatedQuestIds",
        "relatedSessionIds",
        "relatedFactionIds"
      ]) {
        if (!Array.isArray(patch[key])) continue;
        faction[key] = [...new Set(
          patch[key].filter((value) => typeof value === "string" && value)
        )];
      }
      faction.updated = Date.now();
      updated = foundry.utils.duplicate(faction);
    });
    if (updated) {
      const { CampaignActivityService } = await import("./campaign-activity-service.js");
      CampaignActivityService.edited(
        "faction",
        id,
        updated.name,
        CampaignActivityService.patchFieldLabel(patch, {
          name: "Name",
          icon: "Icon",
          description: "Description",
          currentStatus: "Current Status",
          resources: "Resources",
          playerReputation: "Player Reputation",
          currentObjectives: "Current Objectives",
          relatedActorIds: "Relationships",
          relatedStoryThreadIds: "Relationships",
          relatedItemIds: "Relationships",
          relatedLocationIds: "Relationships",
          relatedQuestIds: "Relationships",
          relatedSessionIds: "Relationships",
          relatedFactionIds: "Relationships",
          leadershipActorIds: "Relationships"
        })
      );
    }
    return updated;
  }
}
