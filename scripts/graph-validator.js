import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { CompanionStorage } from "./storage.js";
import { EntityLinkService } from "./entity-link-service.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * Validates the campaign relationship graph and purges orphaned references.
 */
export class GraphValidator {
  /** @type {boolean} */
  static #hooksRegistered = false;

  /** Register Foundry delete hooks to purge orphaned relationships. */
  static registerDeleteHooks() {
    if (GraphValidator.#hooksRegistered) return;
    GraphValidator.#hooksRegistered = true;
    const purge = (kind, document) => {
      const id = document?.uuid || document?.id;
      if (!id) return;
      void GraphValidator.purgeEntity({ kind, id }).catch((error) => {
        console.error("N&D Companion: relationship purge failed", error);
      });
    };
    Hooks.on("deleteActor", (document) => purge("actor", document));
    Hooks.on("deleteItem", (document) => purge("item", document));
    Hooks.on("deleteScene", (document) => purge("location", document));
  }

  /**
   * @returns {Promise<{
   *   ok: boolean,
   *   orphans: Array<{ ownerKind: string, ownerId: string, field?: string, kind: string, id: string, source: string }>,
   *   removed: number
   * }>}
   */
  static async validate({ purge = false } = {}) {
    const orphans = GraphValidator.#collectOrphans();
    let removed = 0;
    if (purge && orphans.length) {
      removed = await GraphValidator.#purge(orphans);
    }
    return {
      ok: orphans.length === 0,
      orphans,
      removed
    };
  }

  /**
   * @param {{ notify?: boolean, purge?: boolean }} [options]
   */
  static async report(options = {}) {
    const result = await GraphValidator.validate({ purge: options.purge === true });
    if (result.ok) return result;
    console.warn(
      `N&D Companion: ${result.orphans.length} broken relationship reference(s) found.`,
      result.orphans
    );
    if (options.notify && game.user?.isGM && result.removed) {
      ui.notifications?.warn(
        `N&D Companion: cleaned ${result.removed} broken relationship reference(s).`
      );
    }
    return result;
  }

  /**
   * @param {{ kind: string, id: string }} entity
   */
  static async purgeEntity(entity) {
    if (!entity?.kind || !entity?.id) return;
    const kind = entity.kind === "scene" ? "location" : entity.kind;
    const id = entity.id;

    await CampaignDocument.update((doc) => {
      for (const thread of doc.storyThreads) {
        GraphValidator.#filterField(thread, "relatedActorIds", kind, id, "actor");
        GraphValidator.#filterField(thread, "relatedLocationIds", kind, id, "location");
        GraphValidator.#filterField(thread, "relatedItemIds", kind, id, "item");
        GraphValidator.#filterField(thread, "relatedQuestIds", kind, id, "quest");
        GraphValidator.#filterField(thread, "relatedSessionIds", kind, id, "session");
      }
      for (const entry of doc.storyEntries) {
        GraphValidator.#filterField(entry, "relatedCharacterIds", kind, id, "actor");
        GraphValidator.#filterField(entry, "relatedLocationIds", kind, id, "location");
        GraphValidator.#filterField(entry, "relatedItemIds", kind, id, "item");
        GraphValidator.#filterField(entry, "relatedBeatIds", kind, id, "questEntry");
      }
      for (const faction of doc.factions) {
        GraphValidator.#filterField(faction, "relatedActorIds", kind, id, "actor");
        GraphValidator.#filterField(faction, "leadershipActorIds", kind, id, "actor");
        GraphValidator.#filterField(faction, "relatedLocationIds", kind, id, "location");
        GraphValidator.#filterField(faction, "relatedItemIds", kind, id, "item");
        GraphValidator.#filterField(faction, "relatedStoryThreadIds", kind, id, "storyThread");
        GraphValidator.#filterField(faction, "relatedQuestIds", kind, id, "quest");
        GraphValidator.#filterField(faction, "relatedFactionIds", kind, id, "faction");
        GraphValidator.#filterField(faction, "relatedSessionIds", kind, id, "session");
      }
    });

    await EntityLinkService.purgeEntity({ kind, id });
  }

  static #collectOrphans() {
    const orphans = [];
    const doc = CampaignDocument.get();

    for (const thread of doc.storyThreads) {
      GraphValidator.#scanIds(orphans, {
        ownerKind: "storyThread",
        ownerId: thread.id,
        field: "relatedActorIds",
        kind: "actor",
        ids: thread.relatedActorIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "storyThread",
        ownerId: thread.id,
        field: "relatedLocationIds",
        kind: "location",
        ids: thread.relatedLocationIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "storyThread",
        ownerId: thread.id,
        field: "relatedItemIds",
        kind: "item",
        ids: thread.relatedItemIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "storyThread",
        ownerId: thread.id,
        field: "relatedQuestIds",
        kind: "quest",
        ids: thread.relatedQuestIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "storyThread",
        ownerId: thread.id,
        field: "relatedSessionIds",
        kind: "session",
        ids: thread.relatedSessionIds,
        source: "document"
      });
    }

    for (const entry of doc.storyEntries) {
      GraphValidator.#scanIds(orphans, {
        ownerKind: "questEntry",
        ownerId: entry.id,
        field: "relatedCharacterIds",
        kind: "actor",
        ids: entry.relatedCharacterIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "questEntry",
        ownerId: entry.id,
        field: "relatedLocationIds",
        kind: "location",
        ids: entry.relatedLocationIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "questEntry",
        ownerId: entry.id,
        field: "relatedItemIds",
        kind: "item",
        ids: entry.relatedItemIds,
        source: "document"
      });
      GraphValidator.#scanIds(orphans, {
        ownerKind: "questEntry",
        ownerId: entry.id,
        field: "relatedBeatIds",
        kind: "questEntry",
        ids: entry.relatedBeatIds,
        source: "document"
      });
    }

    for (const faction of doc.factions) {
      for (const [field, kind] of [
        ["relatedActorIds", "actor"],
        ["leadershipActorIds", "actor"],
        ["relatedLocationIds", "location"],
        ["relatedItemIds", "item"],
        ["relatedStoryThreadIds", "storyThread"],
        ["relatedQuestIds", "quest"],
        ["relatedFactionIds", "faction"],
        ["relatedSessionIds", "session"]
      ]) {
        GraphValidator.#scanIds(orphans, {
          ownerKind: "faction",
          ownerId: faction.id,
          field,
          kind,
          ids: faction[field],
          source: "document"
        });
      }
    }

    for (const link of EntityLinkService.list()) {
      if (!GraphValidator.#exists(link.aKind, link.aId)) {
        orphans.push({
          ownerKind: link.bKind,
          ownerId: link.bId,
          kind: link.aKind,
          id: link.aId,
          source: "link"
        });
      }
      if (!GraphValidator.#exists(link.bKind, link.bId)) {
        orphans.push({
          ownerKind: link.aKind,
          ownerId: link.aId,
          kind: link.bKind,
          id: link.bId,
          source: "link"
        });
      }
    }

    return orphans;
  }

  static #scanIds(orphans, { ownerKind, ownerId, field, kind, ids, source }) {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (!id || GraphValidator.#exists(kind, id)) continue;
      orphans.push({ ownerKind, ownerId, field, kind, id, source });
    }
  }

  static #exists(kind, id) {
    const normalized = kind === "scene" ? "location" : kind;
    switch (normalized) {
      case "actor":
      case "location":
      case "item":
        return Boolean(
          EntityRegistry.findByUUID(id) ||
          EntityRegistry.all(normalized === "location" ? "scene" : normalized)
            .some((entity) => entity.id === id || entity.uuid === id)
        );
      case "storyThread":
        return Boolean(StoryThreadService.getById(id));
      case "questEntry":
      case "beat":
        return Boolean(QuestEntryService.getById(id));
      case "faction":
        return Boolean(FactionService.getById(id));
      case "quest":
        return CampaignDocument.get().threads.some((quest) => quest.id === id);
      case "session":
        return Boolean(
          CampaignMemoryService.getById(id) ||
          CampaignDocument.get().sessions.some((session) => session.id === id)
        );
      default:
        return false;
    }
  }

  static #filterField(owner, field, deletedKind, deletedId, expectedKind) {
    if (deletedKind !== expectedKind || !Array.isArray(owner[field])) return;
    owner[field] = owner[field].filter((value) => value !== deletedId);
  }

  static async #purge(orphans) {
    let removed = 0;

    await CampaignDocument.update((doc) => {
      for (const orphan of orphans) {
        if (orphan.source !== "document" || !orphan.field) continue;
        let owner = null;
        if (orphan.ownerKind === "storyThread") {
          owner = doc.storyThreads.find((thread) => thread.id === orphan.ownerId);
        } else if (orphan.ownerKind === "questEntry") {
          owner = doc.storyEntries.find((entry) => entry.id === orphan.ownerId);
        } else if (orphan.ownerKind === "faction") {
          owner = doc.factions.find((faction) => faction.id === orphan.ownerId);
        }
        if (!owner || !Array.isArray(owner[orphan.field])) continue;
        const before = owner[orphan.field].length;
        owner[orphan.field] = owner[orphan.field].filter((value) => value !== orphan.id);
        removed += before - owner[orphan.field].length;
      }
    });

    if (orphans.some((entry) => entry.source === "link")) {
      const links = EntityLinkService.list();
      const next = links.filter((link) => {
        const keep =
          GraphValidator.#exists(link.aKind, link.aId) &&
          GraphValidator.#exists(link.bKind, link.bId);
        if (!keep) removed += 1;
        return keep;
      });
      if (next.length !== links.length) {
        await CompanionStorage.setEntityLinks(next);
      }
    }

    return removed;
  }
}
