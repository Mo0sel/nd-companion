import { CampaignDocument } from "./campaign-document.js";
import { CompanionStorage } from "./storage.js";
import {
  RELATIONSHIP_TYPE,
  normalizeRelationshipType
} from "./relationship-types.js";

/**
 * First-class campaign relationship graph (Sprint 40).
 * One undirected "Related" edge is stored once; both ends see it.
 */
export class RelationshipService {
  /** @type {boolean} */
  static #migrated = false;

  /**
   * @returns {import("./storage.js").CampaignRelationship[]}
   */
  static list() {
    return CompanionStorage.getRelationships();
  }

  /** @returns {number} */
  static revision() {
    return CompanionStorage.getRelationshipsRevision();
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @param {boolean} connect
   */
  static async #notifyEdge(left, right, connect) {
    try {
      const { ContextEngine } = await import("./context-engine.js");
      ContextEngine.applyEdge(left, right, connect);
    } catch (error) {
      console.error("N&D Companion: relationship index update failed", error);
    }
  }

  /**
   * @returns {import("./storage.js").CampaignRelationship[]}
   */
  static list() {
    return CompanionStorage.getRelationships();
  }

  /** @returns {number} */
  static revision() {
    return CompanionStorage.getRelationshipsRevision();
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @param {{ relationshipType?: string }} [options]
   * @returns {Promise<import("./storage.js").CampaignRelationship|null>}
   */
  static async connect(left, right, options = {}) {
    const a = RelationshipService.#normalize(left);
    const b = RelationshipService.#normalize(right);
    if (!a || !b) return null;
    if (a.kind === b.kind && a.id === b.id) return null;

    const relationshipType = normalizeRelationshipType(options.relationshipType);
    const existing = RelationshipService.findBetween(a, b, relationshipType);
    if (existing) return existing;

    const now = Date.now();
    const [source, target] = RelationshipService.#ordered(a, b);
    const relationship = {
      id: foundry.utils.randomID(),
      sourceId: source.id,
      targetId: target.id,
      sourceType: source.kind,
      targetType: target.kind,
      relationshipType,
      createdAt: now,
      updatedAt: now
    };

    const relationships = RelationshipService.list();
    relationships.push(relationship);
    await CompanionStorage.setRelationships(relationships);
    await RelationshipService.#notifyEdge(source, target, true);
    return relationship;
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @param {{ relationshipType?: string }} [options]
   * @returns {Promise<boolean>}
   */
  static async disconnect(left, right, options = {}) {
    const a = RelationshipService.#normalize(left);
    const b = RelationshipService.#normalize(right);
    if (!a || !b) return false;

    const relationshipType = options.relationshipType
      ? normalizeRelationshipType(options.relationshipType)
      : null;
    const relationships = RelationshipService.list();
    const next = relationships.filter((rel) => {
      if (!RelationshipService.#matchesPair(rel, a, b)) return true;
      if (relationshipType && rel.relationshipType !== relationshipType) return true;
      return false;
    });
    if (next.length === relationships.length) return false;
    await CompanionStorage.setRelationships(next);
    await RelationshipService.#notifyEdge(a, b, false);
    return true;
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @param {string} [relationshipType]
   */
  static findBetween(left, right, relationshipType = RELATIONSHIP_TYPE.RELATED) {
    const a = RelationshipService.#normalize(left);
    const b = RelationshipService.#normalize(right);
    if (!a || !b) return null;
    const type = normalizeRelationshipType(relationshipType);
    return (
      RelationshipService.list().find(
        (rel) =>
          rel.relationshipType === type && RelationshipService.#matchesPair(rel, a, b)
      ) ?? null
    );
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   */
  static has(left, right) {
    return Boolean(RelationshipService.findBetween(left, right));
  }

  /**
   * Neighbors across all relationship types (undirected).
   * @param {{ kind: string, id: string }} entity
   * @returns {{ kind: string, id: string, relationshipType: string, relationshipId: string }[]}
   */
  static neighbors(entity) {
    const ref = RelationshipService.#normalize(entity);
    if (!ref) return [];
    const out = [];
    for (const rel of RelationshipService.list()) {
      if (rel.sourceType === ref.kind && rel.sourceId === ref.id) {
        out.push({
          kind: rel.targetType,
          id: rel.targetId,
          relationshipType: rel.relationshipType,
          relationshipId: rel.id
        });
      } else if (rel.targetType === ref.kind && rel.targetId === ref.id) {
        out.push({
          kind: rel.sourceType,
          id: rel.sourceId,
          relationshipType: rel.relationshipType,
          relationshipId: rel.id
        });
      }
    }
    return out;
  }

  /**
   * @param {{ kind: string, id: string }} entity
   * @returns {Promise<number>}
   */
  static async purgeEntity(entity) {
    const ref = RelationshipService.#normalize(entity);
    if (!ref) return 0;
    const relationships = RelationshipService.list();
    const removed = [];
    const next = relationships.filter((rel) => {
      const hit =
        (rel.sourceType === ref.kind && rel.sourceId === ref.id) ||
        (rel.targetType === ref.kind && rel.targetId === ref.id);
      if (hit) removed.push(rel);
      return !hit;
    });
    if (!removed.length) return 0;
    await CompanionStorage.setRelationships(next);
    for (const rel of removed) {
      await RelationshipService.#notifyEdge(
        { kind: rel.sourceType, id: rel.sourceId },
        { kind: rel.targetType, id: rel.targetId },
        false
      );
    }
    return removed.length;
  }

  /**
   * Migrate legacy undirected links + document related* arrays into Relationships.
   * Idempotent — skips pairs that already exist.
   */
  static async migrateFromLegacy() {
    if (RelationshipService.#migrated) return;
    RelationshipService.#migrated = true;

    const before = RelationshipService.list();
    const byKey = new Map(before.map((rel) => [RelationshipService.#pairKey(rel), rel]));
    let added = 0;
    const now = Date.now();

    const upsert = (left, right) => {
      const a = RelationshipService.#normalize(left);
      const b = RelationshipService.#normalize(right);
      if (!a || !b) return;
      if (a.kind === b.kind && a.id === b.id) return;
      const [source, target] = RelationshipService.#ordered(a, b);
      const key = RelationshipService.#pairKey({
        sourceType: source.kind,
        sourceId: source.id,
        targetType: target.kind,
        targetId: target.id,
        relationshipType: RELATIONSHIP_TYPE.RELATED
      });
      if (byKey.has(key)) return;
      const relationship = {
        id: foundry.utils.randomID(),
        sourceId: source.id,
        targetId: target.id,
        sourceType: source.kind,
        targetType: target.kind,
        relationshipType: RELATIONSHIP_TYPE.RELATED,
        createdAt: now,
        updatedAt: now
      };
      byKey.set(key, relationship);
      added += 1;
    };

    for (const link of CompanionStorage.getLegacyEntityLinks()) {
      upsert(
        { kind: link.aKind, id: link.aId },
        { kind: link.bKind, id: link.bId }
      );
    }

    const doc = CampaignDocument.get();
    for (const thread of doc.storyThreads ?? []) {
      for (const id of thread.relatedActorIds ?? []) upsert({ kind: "storyThread", id: thread.id }, { kind: "actor", id });
      for (const id of thread.relatedLocationIds ?? []) upsert({ kind: "storyThread", id: thread.id }, { kind: "location", id });
      for (const id of thread.relatedItemIds ?? []) upsert({ kind: "storyThread", id: thread.id }, { kind: "item", id });
      for (const id of thread.relatedQuestIds ?? []) upsert({ kind: "storyThread", id: thread.id }, { kind: "quest", id });
      for (const id of thread.relatedSessionIds ?? []) upsert({ kind: "storyThread", id: thread.id }, { kind: "session", id });
    }
    for (const entry of doc.storyEntries ?? []) {
      for (const id of entry.relatedCharacterIds ?? []) upsert({ kind: "questEntry", id: entry.id }, { kind: "actor", id });
      for (const id of entry.relatedLocationIds ?? []) upsert({ kind: "questEntry", id: entry.id }, { kind: "location", id });
      for (const id of entry.relatedItemIds ?? []) upsert({ kind: "questEntry", id: entry.id }, { kind: "item", id });
      for (const id of entry.relatedBeatIds ?? []) upsert({ kind: "questEntry", id: entry.id }, { kind: "questEntry", id });
    }
    for (const faction of doc.factions ?? []) {
      for (const id of faction.relatedActorIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "actor", id });
      for (const id of faction.relatedLocationIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "location", id });
      for (const id of faction.relatedItemIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "item", id });
      for (const id of faction.relatedStoryThreadIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "storyThread", id });
      for (const id of faction.relatedQuestIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "quest", id });
      for (const id of faction.relatedSessionIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "session", id });
      for (const id of faction.relatedFactionIds ?? []) upsert({ kind: "faction", id: faction.id }, { kind: "faction", id });
    }

    if (added) {
      await CompanionStorage.setRelationships([...byKey.values()]);
    } else {
      const raw = game.settings.get("nd-companion", "campaignLinks");
      const needsSchemaWrite =
        (Array.isArray(raw?.links) && raw.links.length > 0) ||
        !Array.isArray(raw?.relationships);
      if (needsSchemaWrite) {
        await CompanionStorage.setRelationships([...byKey.values()]);
      }
    }
  }

  /**
   * Repair duplicates / self-refs / incomplete rows without throwing.
   * @returns {Promise<{ removed: number, repaired: number }>}
   */
  static async sanitize() {
    const input = CompanionStorage.getRelationshipsRaw();
    const seen = new Map();
    let removed = 0;
    let repaired = 0;
    const next = [];

    for (const raw of input) {
      const rel = RelationshipService.#coerce(raw);
      if (!rel) {
        removed += 1;
        continue;
      }
      if (rel.sourceType === rel.targetType && rel.sourceId === rel.targetId) {
        removed += 1;
        continue;
      }
      const [source, target] = RelationshipService.#ordered(
        { kind: rel.sourceType, id: rel.sourceId },
        { kind: rel.targetType, id: rel.targetId }
      );
      if (source.kind !== rel.sourceType || source.id !== rel.sourceId) {
        rel.sourceType = source.kind;
        rel.sourceId = source.id;
        rel.targetType = target.kind;
        rel.targetId = target.id;
        repaired += 1;
      }
      rel.relationshipType = normalizeRelationshipType(rel.relationshipType);
      const key = RelationshipService.#pairKey(rel);
      if (seen.has(key)) {
        removed += 1;
        continue;
      }
      seen.set(key, true);
      next.push(rel);
    }

    if (removed || repaired || next.length !== input.length) {
      await CompanionStorage.setRelationships(next);
    }
    return { removed, repaired };
  }

  static #coerce(raw) {
    if (!raw || typeof raw !== "object") return null;
    // Legacy undirected link shape
    if (raw.aKind && raw.aId && raw.bKind && raw.bId && !raw.sourceId) {
      const [source, target] = RelationshipService.#ordered(
        RelationshipService.#normalize({ kind: raw.aKind, id: raw.aId }),
        RelationshipService.#normalize({ kind: raw.bKind, id: raw.bId })
      );
      if (!source || !target) return null;
      const now = Date.now();
      return {
        id: String(raw.id || foundry.utils.randomID()),
        sourceId: source.id,
        targetId: target.id,
        sourceType: source.kind,
        targetType: target.kind,
        relationshipType: RELATIONSHIP_TYPE.RELATED,
        createdAt: Number(raw.createdAt) || now,
        updatedAt: Number(raw.updatedAt) || now
      };
    }
    const sourceType = RelationshipService.#normalizeKind(raw.sourceType);
    const targetType = RelationshipService.#normalizeKind(raw.targetType);
    const sourceId = String(raw.sourceId ?? "").trim();
    const targetId = String(raw.targetId ?? "").trim();
    if (!sourceType || !targetType || !sourceId || !targetId) return null;
    const now = Date.now();
    return {
      id: String(raw.id || foundry.utils.randomID()),
      sourceId,
      targetId,
      sourceType,
      targetType,
      relationshipType: normalizeRelationshipType(raw.relationshipType),
      createdAt: Number(raw.createdAt) || now,
      updatedAt: Number(raw.updatedAt) || now
    };
  }

  static #normalize(ref) {
    if (!ref?.kind || !ref?.id) return null;
    const kind = RelationshipService.#normalizeKind(ref.kind);
    const id = String(ref.id).trim();
    if (!kind || !id) return null;
    return { kind, id };
  }

  static #normalizeKind(kind) {
    const value = String(kind ?? "").trim();
    if (value === "scene") return "location";
    if (value === "beat") return "questEntry";
    return value || null;
  }

  static #ordered(left, right) {
    const leftKey = `${left.kind}:${left.id}`;
    const rightKey = `${right.kind}:${right.id}`;
    return leftKey <= rightKey ? [left, right] : [right, left];
  }

  static #matchesPair(rel, left, right) {
    return (
      (rel.sourceType === left.kind &&
        rel.sourceId === left.id &&
        rel.targetType === right.kind &&
        rel.targetId === right.id) ||
      (rel.sourceType === right.kind &&
        rel.sourceId === right.id &&
        rel.targetType === left.kind &&
        rel.targetId === left.id)
    );
  }

  static #pairKey(rel) {
    const [source, target] = RelationshipService.#ordered(
      { kind: rel.sourceType, id: rel.sourceId },
      { kind: rel.targetType, id: rel.targetId }
    );
    return `${rel.relationshipType}|${source.kind}:${source.id}|${target.kind}:${target.id}`;
  }
}
