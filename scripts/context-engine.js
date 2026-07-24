import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { EntityRegistry } from "./entity-registry.js";
import { GraphService } from "./graph-service.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { RelationshipService } from "./relationship-service.js";
import { RichText } from "./rich-text.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
import { CompanionStorage } from "./storage.js";

/**
 * Context Engine — "What matters right now?"
 *
 * Orchestrates GraphService relationships, session state, chronicle history,
 * and Foundry metadata into cached context packets.
 * Not an AI system. UI and future AI consume this layer only.
 */
export class ContextEngine {
  /** @type {number} */
  static #stampDoc = -1;

  /** @type {number} */
  static #stampLinks = -1;

  /** @type {number} */
  static #stampPlay = -1;

  /** @type {Map<string, object>} */
  static #packetCache = new Map();

  /** @type {number} */
  static #revision = -1;

  /** @type {number} */
  static #linksRevision = -1;

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

  /** Drop all cached packets. Next getters rebuild. */
  static invalidate() {
    ContextEngine.#packetCache.clear();
    ContextEngine.#stampDoc = -1;
    ContextEngine.#stampLinks = -1;
    ContextEngine.#stampPlay = -1;
  }

  /** Force a fresh rebuild of graph-backed indexes + clear packet cache. */
  static refresh() {
    ContextEngine.invalidate();
    GraphService.rebuild();
    ContextEngine.#ensureIndex();
  }

  /**
   * Relationship store hook — keep legacy adjacency warm and drop packets.
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @param {boolean} connect
   */
  static applyEdge(left, right, connect) {
    ContextEngine.invalidate();
    if (!left?.kind || !left?.id || !right?.kind || !right?.id) return;
    if (left.kind === right.kind && left.id === right.id) return;

    if (ContextEngine.#revision !== CampaignDocument.revision) {
      ContextEngine.#ensureIndex();
      return;
    }

    ContextEngine.#linksRevision = RelationshipService.revision();
    if (connect) {
      ContextEngine.#connectGroup([left, right]);
      return;
    }

    const a = ContextEngine.#key(left.kind, left.id);
    const b = ContextEngine.#key(right.kind, right.id);
    ContextEngine.#adjacency.get(a)?.delete(b);
    ContextEngine.#adjacency.get(b)?.delete(a);
  }

  /**
   * Portrait/metadata for UI — delegates to GraphService so UI never imports it.
   * @param {string} type
   * @param {string} id
   */
  static getPortrait(type, id) {
    ContextEngine.#syncStamps();
    return GraphService.getPortrait(type, id);
  }

  /** @param {string} name */
  static initials(name) {
    return GraphService.initials(name);
  }

  /**
   * @param {string|{ kind?: string, type?: string, id?: string, uuid?: string }} typeOrRef
   * @param {string} [id]
   * @returns {EntityContextPacket}
   */
  static getEntityContext(typeOrRef, id) {
    ContextEngine.#syncStamps();
    const target = ContextEngine.#resolveRef(typeOrRef, id);
    if (!target) return ContextEngine.#emptyEntityPacket();

    const cacheKey = `entity:${target.type}:${target.id}`;
    const cached = ContextEngine.#packetCache.get(cacheKey);
    if (cached) return cached;

    const graph = GraphService.getEntityContext(target.type, target.id);
    const status = ContextEngine.#statusFor(target);
    const notesKey = ContextEngine.#notesKey(target);
    const notes = notesKey ? CompanionStorage.getMemory(notesKey) : "";
    const timeline = ContextEngine.#buildTimeline(target.type, target.id);
    const stats = GraphService.getStats();
    const connectedCount = graph.neighbors?.length ?? 0;

    /** @type {EntityContextPacket} */
    const packet = {
      entity: graph.entity,
      foundryDocument: graph.foundryDocument,
      foundry: graph.entity?.foundry ?? null,
      connectedKnowledge: graph.neighbors ?? [],
      relatedActors: graph.connectedActors ?? [],
      relatedItems: graph.connectedItems ?? [],
      relatedLocations: graph.connectedLocations ?? [],
      relatedFactions: graph.connectedFactions ?? [],
      relatedStoryThreads: graph.connectedStoryThreads ?? [],
      relatedQuests: graph.connectedQuests ?? [],
      recentChronicleEvents: timeline.slice(0, 8),
      activeSessions: ContextEngine.#activeSessionNodes(),
      notes,
      status,
      timeline,
      graphSummary: {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        relationshipCount: stats.relationshipCount,
        connectedEntityCount: connectedCount
      }
    };

    ContextEngine.#packetCache.set(cacheKey, packet);
    return packet;
  }

  /**
   * Legacy Connected Knowledge shape used by RelationshipExplorer / ContextPanel.
   * @param {object} entity
   * @returns {ContextResult}
   */
  static getContext(entity) {
    const target = ContextEngine.#normalizeTarget(entity);
    if (!target) return ContextEngine.#empty();
    ContextEngine.#ensureIndex();

    const graphType = target.kind === "questEntry" ? "quest" : target.kind;
    const packet = ContextEngine.getEntityContext(graphType, target.id);
    const base = {
      target: ContextEngine.#node(target.kind, target.id),
      lastSeen: packet.timeline[0]
        ? {
            kind: "session",
            id: packet.timeline[0].sessionId,
            label: packet.timeline[0].label,
            sessionNumber: packet.timeline[0].sessionNumber,
            excerpt: packet.timeline[0].excerpt
          }
        : null,
      sessions: packet.timeline.map((entry) => ({
        kind: "session",
        id: entry.sessionId,
        label: entry.label,
        sessionNumber: entry.sessionNumber,
        excerpt: entry.excerpt,
        title: entry.title ?? "",
        sessionLog: entry.sessionLog ?? ""
      })),
      currentStatus: packet.status,
      campaignMemory: packet.notes,
      timeline: packet.timeline,
      graphSummary: packet.graphSummary
    };

    return {
      ...GraphService.toContextResult(graphType, target.id, base),
      timeline: packet.timeline,
      graphSummary: packet.graphSummary
    };
  }

  /** @returns {SessionContextPacket} */
  static getSessionContext() {
    ContextEngine.#syncStamps();
    const cacheKey = "session:active";
    const cached = ContextEngine.#packetCache.get(cacheKey);
    if (cached) return cached;

    const currentSession = SessionService.getActive();
    const activeStoryThreads = StoryThreadService.list()
      .filter((thread) => thread.status === "ACTIVE")
      .map((thread) => ({
        id: thread.id,
        type: "storyThread",
        name: thread.title?.trim() || "Untitled Story Thread",
        status: thread.status
      }));

    const activeQuests = QuestEntryService.list()
      .filter((entry) => entry.status === "ACTIVE")
      .map((entry) => ({
        id: entry.id,
        type: "quest",
        name: entry.title?.trim() || "Untitled Quest",
        status: entry.status,
        storyThreadId: entry.storyThreadId ?? ""
      }));

    const recentChronicle = CampaignMemoryService.list()
      .slice()
      .sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
      .slice(0, 6)
      .map((session) => ContextEngine.#chronicleEntry(session));

    const recentlyUpdatedEntities = ContextEngine.#recentActivity(12);
    const stats = GraphService.getStats();

    const importantNPCs = [];
    const importantLocations = [];
    const importantItems = [];
    for (const thread of activeStoryThreads) {
      for (const node of GraphService.getNeighbors("storyThread", thread.id)) {
        if (node.type === "actor") importantNPCs.push(node);
        if (node.type === "location") importantLocations.push(node);
        if (node.type === "item") importantItems.push(node);
      }
    }

    /** @type {SessionContextPacket} */
    const packet = {
      currentSession: currentSession
        ? {
            id: currentSession.id,
            sessionNumber: currentSession.sessionNumber,
            title: currentSession.title ?? "",
            status: currentSession.status ?? ""
          }
        : null,
      activeStoryThreads,
      activeQuests,
      recentlyUpdatedEntities,
      unresolvedProblems: activeQuests.filter((quest) => quest.status === "ACTIVE"),
      recentChronicle,
      importantNPCs: ContextEngine.#uniqueNodes(importantNPCs).slice(0, 12),
      importantLocations: ContextEngine.#uniqueNodes(importantLocations).slice(0, 12),
      importantItems: ContextEngine.#uniqueNodes(importantItems).slice(0, 12),
      graphSummary: {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        relationshipCount: stats.relationshipCount,
        connectedEntityCount:
          activeStoryThreads.length + activeQuests.length
      }
    };

    ContextEngine.#packetCache.set(cacheKey, packet);
    return packet;
  }

  /** @returns {CampaignContextPacket} */
  static getCampaignContext() {
    ContextEngine.#syncStamps();
    const cacheKey = "campaign";
    const cached = ContextEngine.#packetCache.get(cacheKey);
    if (cached) return cached;

    const threads = StoryThreadService.list();
    const quests = QuestEntryService.list();
    const currentSession = SessionService.getActive();
    const stats = GraphService.getStats();

    /** @type {CampaignContextPacket} */
    const packet = {
      campaign: {
        name: game.world?.title?.trim() || "Campaign",
        id: game.world?.id ?? ""
      },
      currentSession: currentSession
        ? {
            id: currentSession.id,
            sessionNumber: currentSession.sessionNumber,
            title: currentSession.title ?? "",
            status: currentSession.status ?? ""
          }
        : null,
      activeThreads: threads
        .filter((thread) => thread.status === "ACTIVE")
        .map((thread) => ({
          id: thread.id,
          name: thread.title?.trim() || "Untitled Story Thread",
          status: thread.status
        })),
      completedThreads: threads
        .filter((thread) => thread.status === "COMPLETED")
        .map((thread) => ({
          id: thread.id,
          name: thread.title?.trim() || "Untitled Story Thread",
          status: thread.status
        })),
      openQuests: quests
        .filter((entry) => entry.status === "ACTIVE" || entry.status === "PLANNED")
        .map((entry) => ({
          id: entry.id,
          name: entry.title?.trim() || "Untitled Quest",
          status: entry.status
        })),
      completedQuests: quests
        .filter((entry) => entry.status === "COMPLETED")
        .map((entry) => ({
          id: entry.id,
          name: entry.title?.trim() || "Untitled Quest",
          status: entry.status
        })),
      recentlyChanged: ContextEngine.#recentActivity(20),
      graphStats: stats,
      recentChronicle: CampaignMemoryService.list()
        .slice()
        .sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
        .slice(0, 8)
        .map((session) => ContextEngine.#chronicleEntry(session)),
      graphSummary: {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        relationshipCount: stats.relationshipCount,
        connectedEntityCount: threads.length + quests.length
      }
    };

    ContextEngine.#packetCache.set(cacheKey, packet);
    return packet;
  }

  /** @returns {PlayContextPacket} */
  static getPlayContext() {
    ContextEngine.#syncStamps();
    const playIndex = PlaybookService.getCurrent()?.index ?? -1;
    if (ContextEngine.#stampPlay !== playIndex) {
      ContextEngine.#stampPlay = playIndex;
      ContextEngine.#packetCache.delete("play");
    }

    const cacheKey = "play";
    const cached = ContextEngine.#packetCache.get(cacheKey);
    if (cached) return cached;

    const session = ContextEngine.getSessionContext();
    const current = PlaybookService.getCurrent();
    const beat = current.beat ?? null;
    const stats = GraphService.getStats();

    /** @type {PlayContextPacket} */
    const packet = {
      ...session,
      currentBeat: beat
        ? {
            index: current.index,
            total: current.total,
            title: beat.title ?? "",
            sourceStoryThreadId: beat.sourceStoryThreadId ?? "",
            sourceStoryEntryId: beat.sourceStoryEntryId ?? ""
          }
        : null,
      missionStoryThreadId: beat?.sourceStoryThreadId || "",
      missionQuestId: beat?.sourceStoryEntryId || "",
      graphSummary: {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        relationshipCount: stats.relationshipCount,
        connectedEntityCount: session.activeStoryThreads.length
      }
    };

    ContextEngine.#packetCache.set(cacheKey, packet);
    return packet;
  }

  /**
   * Current Status lives in the existing campaignMemory bag under a namespaced
   * key; no setting or schema is added.
   * @param {object} entity
   * @returns {string}
   */
  static currentStatusKey(entity) {
    const target = ContextEngine.#normalizeTarget(entity);
    if (
      !target ||
      !["actor", "quest", "questEntry", "location", "item"].includes(target.kind)
    ) {
      return "";
    }
    return `status:${ContextEngine.#storageKind(target.kind)}:${target.id}`;
  }

  static #syncStamps() {
    const docRev = CampaignDocument.revision;
    const linksRev = RelationshipService.revision();
    if (
      ContextEngine.#stampDoc !== docRev ||
      ContextEngine.#stampLinks !== linksRev
    ) {
      ContextEngine.#packetCache.clear();
      ContextEngine.#stampDoc = docRev;
      ContextEngine.#stampLinks = linksRev;
    }
  }

  static #resolveRef(typeOrRef, id) {
    if (typeof typeOrRef === "string" && id) {
      const type = ContextEngine.#graphType(typeOrRef);
      return type ? { type, id } : null;
    }
    if (typeOrRef && typeof typeOrRef === "object") {
      const normalized = ContextEngine.#normalizeTarget(typeOrRef);
      if (!normalized) return null;
      return {
        type: ContextEngine.#graphType(normalized.kind),
        id: normalized.id
      };
    }
    return null;
  }

  static #graphType(kind) {
    if (!kind) return null;
    if (kind === "scene") return "location";
    if (kind === "questEntry" || kind === "beat") return "quest";
    return kind;
  }

  static #statusFor(target) {
    if (target.type === "storyThread") {
      return (
        StoryThreadService.getById(target.id)?.currentState ??
        CompanionStorage.getMemory(`storyThread:${target.id}`) ??
        ""
      );
    }
    if (target.type === "faction") {
      ContextEngine.#ensureIndex();
      return ContextEngine.#factions.get(target.id)?.currentStatus ?? "";
    }
    const key = ContextEngine.currentStatusKey({
      kind: target.type === "quest" ? "questEntry" : target.type,
      id: target.id
    });
    return key ? CompanionStorage.getMemory(key) : "";
  }

  static #notesKey(target) {
    if (["actor", "item", "location"].includes(target.type)) {
      const storageKind = ContextEngine.#storageKind(target.type);
      return `${storageKind}:${target.id}`;
    }
    if (target.type === "faction") return `faction:${target.id}`;
    if (target.type === "storyThread") return `storyThread:${target.id}`;
    if (target.type === "quest") return `quest:${target.id}`;
    return "";
  }

  /**
   * Chronicle sessions that reference this entity — newest first.
   * @param {string} type
   * @param {string} id
   * @returns {TimelineEntry[]}
   */
  static #buildTimeline(type, id) {
    ContextEngine.#ensureIndex();
    const node = GraphService.getNode(type, id);
    const name = node?.name?.trim() || "";
    /** @type {Map<string, TimelineEntry>} */
    const byId = new Map();

    for (const session of CampaignMemoryService.list()) {
      if (!ContextEngine.#sessionReferences(session, type, id, name)) continue;
      byId.set(session.id, ContextEngine.#chronicleEntry(session));
    }

    for (const neighbor of GraphService.getConnected(type, id, "session")) {
      const session = CampaignMemoryService.getById(neighbor.id);
      if (!session || byId.has(session.id)) continue;
      byId.set(session.id, ContextEngine.#chronicleEntry(session));
    }

    return [...byId.values()].sort(
      (a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0)
    );
  }

  static #sessionReferences(session, type, id, name) {
    const lists = {
      actor: session.relatedActors ?? [],
      location: session.relatedLocations ?? [],
      item: session.relatedItems ?? [],
      quest: [
        ...(session.relatedQuestEntries ?? []),
        ...(session.relatedQuests ?? [])
      ]
    };
    if (lists[type]?.includes(id)) return true;

    const log = RichText.plainText(session.sessionLog ?? "");
    if (id && log.includes(id)) return true;
    if (name && name.length > 2) {
      const pattern = new RegExp(
        `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
      if (pattern.test(log)) return true;
    }
    return false;
  }

  static #chronicleEntry(session) {
    return {
      sessionId: session.id,
      sessionNumber: session.sessionNumber ?? 0,
      label: CampaignMemoryService.label(session),
      title: session.title ?? "",
      excerpt: ContextEngine.#excerpt(session.sessionLog),
      sessionLog: session.sessionLog ?? "",
      updated: session.updated ?? session.created ?? 0
    };
  }

  static #activeSessionNodes() {
    const active = SessionService.getActive();
    if (!active) return [];
    return [
      {
        id: active.id,
        type: "session",
        name: active.title?.trim() || `Session ${active.sessionNumber ?? ""}`,
        sessionNumber: active.sessionNumber ?? 0
      }
    ];
  }

  static #recentActivity(limit) {
    try {
      return CompanionStorage.getActivityEvents()
        .slice(0, limit)
        .map((event) => ({
          id: event.id,
          timestamp: event.timestamp,
          action: event.action,
          entityKind: event.entityKind,
          entityId: event.entityId,
          entityName: event.entityName,
          fieldName: event.fieldName ?? null
        }));
    } catch {
      return [];
    }
  }

  static #uniqueNodes(nodes) {
    const seen = new Set();
    return nodes.filter((node) => {
      const key = `${node.type}:${node.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static #emptyEntityPacket() {
    return {
      entity: null,
      foundryDocument: null,
      foundry: null,
      connectedKnowledge: [],
      relatedActors: [],
      relatedItems: [],
      relatedLocations: [],
      relatedFactions: [],
      relatedStoryThreads: [],
      relatedQuests: [],
      recentChronicleEvents: [],
      activeSessions: [],
      notes: "",
      status: "",
      timeline: [],
      graphSummary: {
        nodeCount: 0,
        edgeCount: 0,
        relationshipCount: 0,
        connectedEntityCount: 0
      }
    };
  }

  static #ensureIndex() {
    const linksRevision = RelationshipService.revision();
    if (
      ContextEngine.#revision === CampaignDocument.revision &&
      ContextEngine.#linksRevision === linksRevision
    ) {
      return;
    }

    const docRevisionChanged = ContextEngine.#revision !== CampaignDocument.revision;
    const linksOnly =
      !docRevisionChanged &&
      ContextEngine.#revision >= 0 &&
      ContextEngine.#linksRevision !== linksRevision;

    if (linksOnly) {
      ContextEngine.#stripRelationshipEdges();
      for (const rel of RelationshipService.list()) {
        ContextEngine.#connectGroup([
          { kind: rel.sourceType, id: rel.sourceId },
          { kind: rel.targetType, id: rel.targetId }
        ]);
      }
      ContextEngine.#linksRevision = linksRevision;
      return;
    }

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
    ContextEngine.#entries = new Map(doc.storyEntries.map((entry) => [entry.id, entry]));
    ContextEngine.#storyThreads = new Map(
      doc.storyThreads.map((thread) => [thread.id, thread])
    );
    ContextEngine.#factions = new Map(
      doc.factions.map((faction) => [faction.id, faction])
    );

    for (const session of ContextEngine.#sessions.values()) {
      const sessionEntryIds = session.relatedQuestEntries ?? [];
      const owningStoryThreadIds = sessionEntryIds
        .map((entryId) => ContextEngine.#entries.get(entryId)?.storyThreadId)
        .filter(Boolean);
      ContextEngine.#connectGroup([
        { kind: "session", id: session.id },
        ...(session.relatedActors ?? []).map((actorId) => ({ kind: "actor", id: actorId })),
        ...(session.relatedLocations ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(session.relatedItems ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(session.relatedQuests ?? []).map((questId) => ({ kind: "quest", id: questId })),
        ...owningStoryThreadIds.map((threadId) => ({
          kind: "storyThread",
          id: threadId
        })),
        ...sessionEntryIds.map((entryId) => ({ kind: "questEntry", id: entryId }))
      ]);
    }

    for (const quest of ContextEngine.#quests.values()) {
      ContextEngine.#connectGroup([
        { kind: "quest", id: quest.id },
        ...(quest.relatedBeatIds ?? [])
          .filter((entryId) => ContextEngine.#entries.has(entryId))
          .map((entryId) => ({ kind: "questEntry", id: entryId })),
        ...(quest.relatedCharacterIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(quest.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(quest.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId }))
      ]);
    }

    for (const entry of ContextEngine.#entries.values()) {
      ContextEngine.#connectGroup([
        { kind: "questEntry", id: entry.id },
        ...(entry.storyThreadId
          ? [{ kind: "storyThread", id: entry.storyThreadId }]
          : []),
        ...(entry.relatedBeatIds ?? [])
          .filter((entryId) => ContextEngine.#entries.has(entryId))
          .map((entryId) => ({ kind: "questEntry", id: entryId })),
        ...(entry.relatedCharacterIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(entry.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(entry.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId }))
      ]);
    }

    for (const thread of ContextEngine.#storyThreads.values()) {
      ContextEngine.#connectGroup([
        { kind: "storyThread", id: thread.id },
        ...(thread.relatedSessionIds ?? []).map((sessionId) => ({
          kind: "session",
          id: sessionId
        })),
        ...(thread.relatedActorIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(thread.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(thread.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(thread.relatedQuestIds ?? []).map((questId) => ({
          kind: "quest",
          id: questId
        }))
      ]);
    }

    for (const faction of ContextEngine.#factions.values()) {
      const actors = [
        ...(faction.leadershipActorIds ?? []),
        ...(faction.relatedActorIds ?? [])
      ];
      ContextEngine.#connectGroup([
        { kind: "faction", id: faction.id },
        ...(faction.relatedFactionIds ?? []).map((factionId) => ({
          kind: "faction",
          id: factionId
        })),
        ...(faction.relatedStoryThreadIds ?? []).map((threadId) => ({
          kind: "storyThread",
          id: threadId
        })),
        ...(faction.relatedSessionIds ?? []).map((sessionId) => ({
          kind: "session",
          id: sessionId
        })),
        ...actors.map((actorId) => ({ kind: "actor", id: actorId })),
        ...(faction.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(faction.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(faction.relatedQuestIds ?? []).map((questId) => ({
          kind: "quest",
          id: questId
        }))
      ]);
    }

    for (const rel of RelationshipService.list()) {
      ContextEngine.#connectGroup([
        { kind: rel.sourceType, id: rel.sourceId },
        { kind: rel.targetType, id: rel.targetId }
      ]);
    }

    ContextEngine.#revision = CampaignDocument.revision;
    ContextEngine.#linksRevision = linksRevision;
  }

  static #stripRelationshipEdges() {
    ContextEngine.#adjacency = new Map();
    for (const session of ContextEngine.#sessions.values()) {
      const sessionEntryIds = session.relatedQuestEntries ?? [];
      const owningStoryThreadIds = sessionEntryIds
        .map((entryId) => ContextEngine.#entries.get(entryId)?.storyThreadId)
        .filter(Boolean);
      ContextEngine.#connectGroup([
        { kind: "session", id: session.id },
        ...(session.relatedActors ?? []).map((actorId) => ({ kind: "actor", id: actorId })),
        ...(session.relatedLocations ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(session.relatedItems ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(session.relatedQuests ?? []).map((questId) => ({ kind: "quest", id: questId })),
        ...owningStoryThreadIds.map((threadId) => ({
          kind: "storyThread",
          id: threadId
        })),
        ...sessionEntryIds.map((entryId) => ({ kind: "questEntry", id: entryId }))
      ]);
    }
    for (const quest of ContextEngine.#quests.values()) {
      ContextEngine.#connectGroup([
        { kind: "quest", id: quest.id },
        ...(quest.relatedBeatIds ?? [])
          .filter((entryId) => ContextEngine.#entries.has(entryId))
          .map((entryId) => ({ kind: "questEntry", id: entryId })),
        ...(quest.relatedCharacterIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(quest.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(quest.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId }))
      ]);
    }
    for (const entry of ContextEngine.#entries.values()) {
      ContextEngine.#connectGroup([
        { kind: "questEntry", id: entry.id },
        ...(entry.storyThreadId
          ? [{ kind: "storyThread", id: entry.storyThreadId }]
          : []),
        ...(entry.relatedBeatIds ?? [])
          .filter((entryId) => ContextEngine.#entries.has(entryId))
          .map((entryId) => ({ kind: "questEntry", id: entryId })),
        ...(entry.relatedCharacterIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(entry.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(entry.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId }))
      ]);
    }
    for (const thread of ContextEngine.#storyThreads.values()) {
      ContextEngine.#connectGroup([
        { kind: "storyThread", id: thread.id },
        ...(thread.relatedSessionIds ?? []).map((sessionId) => ({
          kind: "session",
          id: sessionId
        })),
        ...(thread.relatedActorIds ?? []).map((actorId) => ({
          kind: "actor",
          id: actorId
        })),
        ...(thread.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(thread.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(thread.relatedQuestIds ?? []).map((questId) => ({
          kind: "quest",
          id: questId
        }))
      ]);
    }
    for (const faction of ContextEngine.#factions.values()) {
      const actors = [
        ...(faction.leadershipActorIds ?? []),
        ...(faction.relatedActorIds ?? [])
      ];
      ContextEngine.#connectGroup([
        { kind: "faction", id: faction.id },
        ...(faction.relatedFactionIds ?? []).map((factionId) => ({
          kind: "faction",
          id: factionId
        })),
        ...(faction.relatedStoryThreadIds ?? []).map((threadId) => ({
          kind: "storyThread",
          id: threadId
        })),
        ...(faction.relatedSessionIds ?? []).map((sessionId) => ({
          kind: "session",
          id: sessionId
        })),
        ...actors.map((actorId) => ({ kind: "actor", id: actorId })),
        ...(faction.relatedLocationIds ?? []).map((locationId) => ({
          kind: "location",
          id: locationId
        })),
        ...(faction.relatedItemIds ?? []).map((itemId) => ({ kind: "item", id: itemId })),
        ...(faction.relatedQuestIds ?? []).map((questId) => ({
          kind: "quest",
          id: questId
        }))
      ]);
    }
  }

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
    let kind = entity.kind ?? entity.type;
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
    if (kind === "location") return "scene";
    if (kind === "questEntry") return "quest";
    return kind;
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
      campaignMemory: "",
      timeline: [],
      graphSummary: {
        nodeCount: 0,
        edgeCount: 0,
        relationshipCount: 0,
        connectedEntityCount: 0
      }
    };
  }
}

/**
 * @typedef {object} TimelineEntry
 * @property {string} sessionId
 * @property {number} sessionNumber
 * @property {string} label
 * @property {string} title
 * @property {string} excerpt
 * @property {string} [sessionLog]
 * @property {number} [updated]
 */

/**
 * @typedef {object} EntityContextPacket
 * @property {object|null} entity
 * @property {object|null} foundryDocument
 * @property {object|null} foundry
 * @property {object[]} connectedKnowledge
 * @property {object[]} relatedActors
 * @property {object[]} relatedItems
 * @property {object[]} relatedLocations
 * @property {object[]} relatedFactions
 * @property {object[]} relatedStoryThreads
 * @property {object[]} relatedQuests
 * @property {TimelineEntry[]} recentChronicleEvents
 * @property {object[]} activeSessions
 * @property {string} notes
 * @property {string} status
 * @property {TimelineEntry[]} timeline
 * @property {object} graphSummary
 */

/**
 * @typedef {object} SessionContextPacket
 * @property {object|null} currentSession
 * @property {object[]} activeStoryThreads
 * @property {object[]} activeQuests
 * @property {object[]} recentlyUpdatedEntities
 * @property {object[]} unresolvedProblems
 * @property {TimelineEntry[]} recentChronicle
 * @property {object[]} importantNPCs
 * @property {object[]} importantLocations
 * @property {object[]} importantItems
 * @property {object} graphSummary
 */

/**
 * @typedef {object} CampaignContextPacket
 * @property {object} campaign
 * @property {object|null} currentSession
 * @property {object[]} activeThreads
 * @property {object[]} completedThreads
 * @property {object[]} openQuests
 * @property {object[]} completedQuests
 * @property {object[]} recentlyChanged
 * @property {object} graphStats
 * @property {TimelineEntry[]} recentChronicle
 * @property {object} graphSummary
 */

/**
 * @typedef {SessionContextPacket & {
 *   currentBeat: object|null,
 *   missionStoryThreadId: string,
 *   missionQuestId: string
 * }} PlayContextPacket
 */

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
 * @property {TimelineEntry[]} [timeline]
 * @property {object} [graphSummary]
 */
