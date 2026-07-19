import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { EntityRegistry } from "./entity-registry.js";
import { RichText } from "./rich-text.js";
import { CompanionStorage } from "./storage.js";

/**
 * Read-only contextual projection of the existing campaign relationship graph.
 * The graph is rebuilt once per CampaignDocument revision, never per click.
 */
export class ContextEngine {
  /** @type {number} */
  static #revision = -1;

  /** @type {Map<string, Set<string>>} */
  static #adjacency = new Map();

  /** @type {Map<string, object>} */
  static #sessions = new Map();

  /** @type {Map<string, object>} */
  static #quests = new Map();

  /** @type {Map<string, object>} */
  static #entries = new Map();

  /** @type {Map<string, object>} */
  static #storyThreads = new Map();

  /** @type {Map<string, object>} */
  static #factions = new Map();

  /**
   * @param {object} entity Actor, Quest, Location, Item, or Chronicle Session
   * @returns {ContextResult}
   */
  static getContext(entity) {
    const target = ContextEngine.#normalizeTarget(entity);
    if (!target) return ContextEngine.#empty();
    ContextEngine.#ensureIndex();

    const targetKey = ContextEngine.#key(target.kind, target.id);
    const relatedKeys = ContextEngine.#adjacency.get(targetKey) ?? new Set();
    const related = [...relatedKeys]
      .map((key) => ContextEngine.#nodeFromKey(key))
      .filter(Boolean);

    const sessions = related
      .filter((node) => node.kind === "session")
      .concat(target.kind === "session" ? [ContextEngine.#node(target.kind, target.id)] : [])
      .filter(Boolean)
      .sort((a, b) => a.sessionNumber - b.sessionNumber);

    const unique = (nodes) => {
      const seen = new Set();
      return nodes.filter((node) => {
        const key = ContextEngine.#key(node.kind, node.id);
        if (seen.has(key) || key === targetKey) return false;
        seen.add(key);
        return true;
      });
    };
    const byLabel = (a, b) => a.label.localeCompare(b.label);

    return {
      target: ContextEngine.#node(target.kind, target.id),
      lastSeen: sessions.at(-1) ?? null,
      sessions: unique(sessions),
      quests: unique(related.filter((node) => node.kind === "quest")).sort(byLabel),
      questEntries: unique(
        related.filter((node) => node.kind === "questEntry")
      ).sort(byLabel),
      actors: unique(related.filter((node) => node.kind === "actor")).sort(byLabel),
      locations: unique(related.filter((node) => node.kind === "location")).sort(byLabel),
      items: unique(related.filter((node) => node.kind === "item")).sort(byLabel),
      storyThreads: unique(
        related.filter((node) => node.kind === "storyThread")
      ).sort(byLabel),
      factions: unique(
        related.filter((node) => node.kind === "faction")
      ).sort(byLabel),
      currentStatus: target.kind === "storyThread"
        ? ContextEngine.#storyThreads.get(target.id)?.currentState ?? ""
        : target.kind === "faction"
          ? ContextEngine.#factions.get(target.id)?.currentStatus ?? ""
          : CompanionStorage.getMemory(ContextEngine.currentStatusKey(target)),
      campaignMemory: CompanionStorage.getMemory(
        `${ContextEngine.#storageKind(target.kind)}:${target.id}`
      )
    };
  }

  /**
   * Current Status lives in the existing campaignMemory bag under a namespaced
   * key; no setting or schema is added.
   * @param {object} entity
   * @returns {string}
   */
  static currentStatusKey(entity) {
    const target = ContextEngine.#normalizeTarget(entity);
    if (!target || !["actor", "quest", "location", "item"].includes(target.kind)) return "";
    return `status:${ContextEngine.#storageKind(target.kind)}:${target.id}`;
  }

  static #ensureIndex() {
    if (ContextEngine.#revision === CampaignDocument.revision) return;

    const doc = CampaignDocument.get();
    ContextEngine.#adjacency = new Map();
    ContextEngine.#sessions = new Map(
      doc.sessions
        .filter((session) => session.status === "completed")
        .map((session) => [
          session.id,
          {
            ...session,
            contextExcerpt: ContextEngine.#excerpt(session.sessionLog)
          }
        ])
    );
    ContextEngine.#quests = new Map(doc.threads.map((quest) => [quest.id, quest]));
    ContextEngine.#entries = new Map(doc.questEntries.map((entry) => [entry.id, entry]));
    ContextEngine.#storyThreads = new Map(
      doc.storyThreads.map((thread) => [thread.id, thread])
    );
    ContextEngine.#factions = new Map(
      doc.factions.map((faction) => [faction.id, faction])
    );

    for (const session of ContextEngine.#sessions.values()) {
      const sessionEntryIds = session.relatedQuestEntries ?? [];
      const owningQuestIds = sessionEntryIds
        .map((id) => ContextEngine.#entries.get(id)?.questId)
        .filter(Boolean);
      ContextEngine.#connectGroup([
        { kind: "session", id: session.id },
        ...(session.relatedActors ?? []).map((id) => ({ kind: "actor", id })),
        ...(session.relatedLocations ?? []).map((id) => ({ kind: "location", id })),
        ...(session.relatedItems ?? []).map((id) => ({ kind: "item", id })),
        ...[...(session.relatedQuests ?? []), ...owningQuestIds].map(
          (id) => ({ kind: "quest", id })
        ),
        ...sessionEntryIds.map((id) => ({ kind: "questEntry", id }))
      ]);
    }

    for (const quest of ContextEngine.#quests.values()) {
      const entryIds = new Set([...(quest.entryIds ?? []), ...(quest.relatedBeatIds ?? [])]);
      ContextEngine.#connectGroup([
        { kind: "quest", id: quest.id },
        ...[...entryIds]
          .filter((id) => ContextEngine.#entries.has(id))
          .map((id) => ({ kind: "questEntry", id })),
        ...(quest.relatedCharacterIds ?? []).map((id) => ({ kind: "actor", id })),
        ...(quest.relatedLocationIds ?? []).map((id) => ({ kind: "location", id })),
        ...(quest.relatedItemIds ?? []).map((id) => ({ kind: "item", id }))
      ]);
    }

    for (const entry of ContextEngine.#entries.values()) {
      ContextEngine.#connectGroup([
        { kind: "questEntry", id: entry.id },
        ...(entry.questId ? [{ kind: "quest", id: entry.questId }] : []),
        ...(entry.relatedBeatIds ?? [])
          .filter((id) => ContextEngine.#entries.has(id))
          .map((id) => ({ kind: "questEntry", id })),
        ...(entry.relatedCharacterIds ?? []).map((id) => ({ kind: "actor", id })),
        ...(entry.relatedLocationIds ?? []).map((id) => ({ kind: "location", id })),
        ...(entry.relatedItemIds ?? []).map((id) => ({ kind: "item", id }))
      ]);
    }

    for (const thread of ContextEngine.#storyThreads.values()) {
      ContextEngine.#connectGroup([
        { kind: "storyThread", id: thread.id },
        ...(thread.relatedSessionIds ?? []).map((id) => ({ kind: "session", id })),
        ...(thread.relatedActorIds ?? []).map((id) => ({ kind: "actor", id })),
        ...(thread.relatedLocationIds ?? []).map((id) => ({ kind: "location", id })),
        ...(thread.relatedItemIds ?? []).map((id) => ({ kind: "item", id })),
        ...(thread.relatedQuestIds ?? []).map((id) => ({ kind: "quest", id }))
      ]);
    }

    for (const faction of ContextEngine.#factions.values()) {
      const actors = [
        ...(faction.leadershipActorIds ?? []),
        ...(faction.relatedActorIds ?? [])
      ];
      ContextEngine.#connectGroup([
        { kind: "faction", id: faction.id },
        ...(faction.relatedFactionIds ?? []).map((id) => ({ kind: "faction", id })),
        ...(faction.relatedStoryThreadIds ?? []).map(
          (id) => ({ kind: "storyThread", id })
        ),
        ...(faction.relatedSessionIds ?? []).map((id) => ({ kind: "session", id })),
        ...actors.map((id) => ({ kind: "actor", id })),
        ...(faction.relatedLocationIds ?? []).map((id) => ({ kind: "location", id })),
        ...(faction.relatedItemIds ?? []).map((id) => ({ kind: "item", id })),
        ...(faction.relatedQuestIds ?? []).map((id) => ({ kind: "quest", id }))
      ]);
    }

    ContextEngine.#revision = CampaignDocument.revision;
  }

  /**
   * Connect every member that already co-occurs in one stored relationship record.
   * @param {{ kind: string, id: string }[]} members
   */
  static #connectGroup(members) {
    const unique = [];
    const seen = new Set();
    for (const member of members) {
      if (!member?.kind || !member?.id) continue;
      const key = ContextEngine.#key(member.kind, member.id);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
      if (!ContextEngine.#adjacency.has(key)) ContextEngine.#adjacency.set(key, new Set());
    }
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        ContextEngine.#adjacency.get(unique[i]).add(unique[j]);
        ContextEngine.#adjacency.get(unique[j]).add(unique[i]);
      }
    }
  }

  static #normalizeTarget(entity) {
    if (!entity || typeof entity !== "object") return null;
    let kind = entity.kind;
    if (kind === "scene") kind = "location";
    if (!kind && Number.isFinite(entity.sessionNumber)) kind = "session";
    if (!kind && (entity.category || Array.isArray(entity.entryIds))) kind = "quest";
    const id = entity.uuid || entity.id;
    if (
      ![
        "actor",
        "quest",
        "questEntry",
        "storyThread",
        "faction",
        "location",
        "item",
        "session"
      ].includes(kind) ||
      !id
    ) {
      return null;
    }
    return { kind, id };
  }

  static #nodeFromKey(key) {
    const separator = key.indexOf(":");
    if (separator < 0) return null;
    return ContextEngine.#node(key.slice(0, separator), key.slice(separator + 1));
  }

  static #node(kind, id) {
    if (!kind || !id) return null;
    if (kind === "session") {
      const session = ContextEngine.#sessions.get(id);
      return session
        ? {
            kind,
            id,
            label: CampaignMemoryService.label(session),
            sessionNumber: session.sessionNumber,
            title: session.title ?? "",
            excerpt: session.contextExcerpt ?? "",
            sessionLog: session.sessionLog ?? ""
          }
        : null;
    }
    if (kind === "quest") {
      const quest = ContextEngine.#quests.get(id);
      return quest
        ? { kind, id, label: quest.title?.trim() || "Untitled Quest" }
        : null;
    }
    if (kind === "questEntry") {
      const entry = ContextEngine.#entries.get(id);
      return entry
        ? { kind, id, label: entry.title?.trim() || "Untitled Entry" }
        : null;
    }
    if (kind === "storyThread") {
      const thread = ContextEngine.#storyThreads.get(id);
      return thread
        ? { kind, id, label: thread.title?.trim() || "Untitled Story Thread" }
        : null;
    }
    if (kind === "faction") {
      const faction = ContextEngine.#factions.get(id);
      return faction
        ? { kind, id, label: faction.name?.trim() || "Untitled Faction" }
        : null;
    }
    const registryKind = ContextEngine.#storageKind(kind);
    const entity = EntityRegistry.findByUUID(id);
    if (!entity || entity.kind !== registryKind) return null;
    return { kind, id, label: entity.name };
  }

  static #storageKind(kind) {
    return kind === "location" ? "scene" : kind;
  }

  static #excerpt(sessionLog) {
    const text = RichText.plainText(sessionLog ?? "");
    if (text.length <= 160) return text;
    return `${text.slice(0, 157).trimEnd()}...`;
  }

  static #key(kind, id) {
    return `${kind}:${id}`;
  }

  static #empty() {
    return {
      target: null,
      lastSeen: null,
      sessions: [],
      quests: [],
      questEntries: [],
      actors: [],
      locations: [],
      items: [],
      storyThreads: [],
      factions: [],
      currentStatus: "",
      campaignMemory: ""
    };
  }
}

/**
 * @typedef {object} ContextNode
 * @property {"actor"|"quest"|"questEntry"|"storyThread"|"faction"|"location"|"item"|"session"} kind
 * @property {string} id
 * @property {string} label
 * @property {number} [sessionNumber]
 * @property {string} [title]
 * @property {string} [excerpt]
 * @property {string} [sessionLog]
 */

/**
 * @typedef {object} ContextResult
 * @property {ContextNode|null} target
 * @property {ContextNode|null} lastSeen
 * @property {ContextNode[]} sessions
 * @property {ContextNode[]} quests
 * @property {ContextNode[]} questEntries
 * @property {ContextNode[]} actors
 * @property {ContextNode[]} locations
 * @property {ContextNode[]} items
 * @property {ContextNode[]} storyThreads
 * @property {ContextNode[]} factions
 * @property {string} currentStatus
 * @property {string} campaignMemory
 */
