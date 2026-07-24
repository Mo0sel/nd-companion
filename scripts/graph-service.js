import { CampaignDocument } from "./campaign-document.js";
import { EntityRegistry } from "./entity-registry.js";
import { RelationshipService } from "./relationship-service.js";

/**
 * In-memory campaign knowledge graph.
 * UI-independent: no Handlebars, Applications, templates, or DOM.
 *
 * Campaign documents and RelationshipService remain the persistence layer.
 * GraphService rebuilds nodes/edges whenever those sources change and is the
 * preferred read API for Connected Knowledge, search, AI, and navigation.
 */

/**
 * @typedef {object} GraphNode
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string|null} documentUuid
 * @property {object} metadata
 * @property {{ uuid: string, documentType: string, img: string, name: string }|null} [foundry]
 */

/**
 * @typedef {object} GraphEdge
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} type
 * @property {string} [source]
 */

/**
 * @typedef {object} EntityContext
 * @property {GraphNode|null} entity
 * @property {object|null} foundryDocument
 * @property {GraphNode[]} neighbors
 * @property {GraphEdge[]} incoming
 * @property {GraphEdge[]} outgoing
 * @property {GraphNode[]} connectedActors
 * @property {GraphNode[]} connectedItems
 * @property {GraphNode[]} connectedLocations
 * @property {GraphNode[]} connectedFactions
 * @property {GraphNode[]} connectedStoryThreads
 * @property {GraphNode[]} connectedQuests
 * @property {GraphNode[]} connectedSessions
 */

/** Edge vocabulary — generic; not tied to a single campaign schema. */
export const GRAPH_EDGE_TYPE = Object.freeze({
  CONTAINS: "contains",
  REFERENCES: "references",
  BELONGS_TO: "belongs_to",
  RELATED: "related"
});

export class GraphService {
  /** @type {boolean} */
  static #ready = false;

  /** @type {number} */
  static #docRevision = -1;

  /** @type {number} */
  static #linksRevision = -1;

  /** @type {Map<string, GraphNode>} */
  static #nodes = new Map();

  /** @type {Map<string, GraphEdge>} */
  static #edges = new Map();

  /** @type {Map<string, Set<string>>} adjacency: nodeKey → edgeIds */
  static #outgoing = new Map();

  /** @type {Map<string, Set<string>>} */
  static #incoming = new Map();

  /** Foundry link cache keyed by node key. */
  /** @type {Map<string, { uuid: string, documentType: string, img: string, name: string }|null>} */
  static #foundryCache = new Map();

  static initialize() {
    GraphService.#ready = true;
    GraphService.rebuild();
  }

  /** Full rebuild from CampaignDocument + RelationshipService + EntityRegistry. */
  static rebuild() {
    GraphService.#nodes = new Map();
    GraphService.#edges = new Map();
    GraphService.#outgoing = new Map();
    GraphService.#incoming = new Map();
    GraphService.#foundryCache = new Map();

    const doc = CampaignDocument.get();

    for (const thread of doc.storyThreads ?? []) {
      GraphService.registerNode({
        id: thread.id,
        type: "storyThread",
        name: thread.title?.trim() || "Untitled Story Thread",
        documentUuid: null,
        metadata: { status: thread.status ?? "" }
      });
    }

    for (const entry of doc.storyEntries ?? []) {
      GraphService.registerNode({
        id: entry.id,
        type: "quest",
        name: entry.title?.trim() || "Untitled Quest",
        documentUuid: null,
        metadata: {
          status: entry.status ?? "",
          storyThreadId: entry.storyThreadId ?? "",
          category: entry.category ?? ""
        }
      });
    }

    for (const faction of doc.factions ?? []) {
      GraphService.registerNode({
        id: faction.id,
        type: "faction",
        name: faction.name?.trim() || "Untitled Faction",
        documentUuid: null,
        metadata: {
          status: faction.currentStatus ?? "",
          reputation: faction.playerReputation ?? ""
        }
      });
    }

    for (const session of doc.sessions ?? []) {
      if (session.status !== "completed") continue;
      GraphService.registerNode({
        id: session.id,
        type: "session",
        name:
          session.title?.trim() ||
          `Session ${session.sessionNumber ?? ""}`.trim() ||
          "Session",
        documentUuid: null,
        metadata: { sessionNumber: session.sessionNumber ?? 0 }
      });
    }

    // World entities referenced anywhere — register as nodes via registry.
    for (const kind of ["actor", "item", "scene"]) {
      for (const entity of EntityRegistry.all(kind)) {
        const type = kind === "scene" ? "location" : kind;
        GraphService.registerNode({
          id: entity.uuid,
          type,
          name: entity.name || "Untitled",
          documentUuid: entity.uuid,
          metadata: {}
        });
      }
    }

    GraphService.#inferDocumentEdges(doc);

    for (const rel of RelationshipService.list()) {
      const fromType = GraphService.#normalizeType(rel.sourceType);
      const toType = GraphService.#normalizeType(rel.targetType);
      if (!fromType || !toType) continue;
      GraphService.registerEdge({
        from: GraphService.#key(fromType, rel.sourceId),
        to: GraphService.#key(toType, rel.targetId),
        type: GRAPH_EDGE_TYPE.RELATED,
        source: "relationshipStore"
      });
    }

    // Attach Foundry link cache for every node that can resolve.
    for (const node of GraphService.#nodes.values()) {
      GraphService.#resolveFoundry(node);
    }

    GraphService.#docRevision = CampaignDocument.revision;
    GraphService.#linksRevision = RelationshipService.revision();
  }

  /**
   * @param {Partial<GraphNode> & { id: string, type: string }} node
   * @returns {GraphNode|null}
   */
  static registerNode(node) {
    if (!node?.id || !node?.type) return null;
    const type = GraphService.#normalizeType(node.type);
    if (!type) return null;
    const key = GraphService.#key(type, node.id);
    const existing = GraphService.#nodes.get(key);
    /** @type {GraphNode} */
    const next = {
      id: node.id,
      type,
      name: node.name?.trim() || existing?.name || "Untitled",
      documentUuid: node.documentUuid ?? existing?.documentUuid ?? null,
      metadata: { ...(existing?.metadata ?? {}), ...(node.metadata ?? {}) },
      foundry: existing?.foundry ?? null
    };
    GraphService.#nodes.set(key, next);
    return next;
  }

  /**
   * @param {{ from: string, to: string, type?: string, source?: string, id?: string }} edge
   * @returns {GraphEdge|null}
   */
  static registerEdge(edge) {
    if (!edge?.from || !edge?.to) return null;
    if (edge.from === edge.to) return null;
    if (!GraphService.#nodes.has(edge.from) || !GraphService.#nodes.has(edge.to)) {
      // Ensure endpoints exist as stubs so inferred refs still connect.
      GraphService.#ensureStub(edge.from);
      GraphService.#ensureStub(edge.to);
    }
    const type = edge.type || GRAPH_EDGE_TYPE.RELATED;
    const id = edge.id || `${edge.from}|${type}|${edge.to}`;
    if (GraphService.#edges.has(id)) return GraphService.#edges.get(id) ?? null;

    /** @type {GraphEdge} */
    const record = {
      id,
      from: edge.from,
      to: edge.to,
      type,
      source: edge.source ?? "inferred"
    };
    GraphService.#edges.set(id, record);
    if (!GraphService.#outgoing.has(edge.from)) {
      GraphService.#outgoing.set(edge.from, new Set());
    }
    if (!GraphService.#incoming.has(edge.to)) {
      GraphService.#incoming.set(edge.to, new Set());
    }
    GraphService.#outgoing.get(edge.from)?.add(id);
    GraphService.#incoming.get(edge.to)?.add(id);
    return record;
  }

  /**
   * @param {string} edgeId
   * @returns {boolean}
   */
  static removeEdge(edgeId) {
    const edge = GraphService.#edges.get(edgeId);
    if (!edge) return false;
    GraphService.#edges.delete(edgeId);
    GraphService.#outgoing.get(edge.from)?.delete(edgeId);
    GraphService.#incoming.get(edge.to)?.delete(edgeId);
    return true;
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {GraphNode|null}
   */
  static getNode(type, id) {
    GraphService.#ensureFresh();
    const normalized = GraphService.#normalizeType(type);
    if (!normalized || !id) return null;
    return GraphService.#nodes.get(GraphService.#key(normalized, id)) ?? null;
  }

  /**
   * Undirected neighbors of a node.
   * @param {string} type
   * @param {string} id
   * @returns {GraphNode[]}
   */
  static getNeighbors(type, id) {
    GraphService.#ensureFresh();
    const key = GraphService.#nodeKey(type, id);
    if (!key) return [];
    const seen = new Set();
    /** @type {GraphNode[]} */
    const neighbors = [];
    for (const edgeId of GraphService.#outgoing.get(key) ?? []) {
      const edge = GraphService.#edges.get(edgeId);
      if (!edge) continue;
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      const node = GraphService.#nodes.get(edge.to);
      if (node) neighbors.push(node);
    }
    for (const edgeId of GraphService.#incoming.get(key) ?? []) {
      const edge = GraphService.#edges.get(edgeId);
      if (!edge) continue;
      if (seen.has(edge.from)) continue;
      seen.add(edge.from);
      const node = GraphService.#nodes.get(edge.from);
      if (node) neighbors.push(node);
    }
    return neighbors.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Neighbors filtered by type.
   * @param {string} type
   * @param {string} id
   * @param {string} neighborType
   * @returns {GraphNode[]}
   */
  static getConnected(type, id, neighborType) {
    const want = GraphService.#normalizeType(neighborType);
    return GraphService.getNeighbors(type, id).filter((node) => node.type === want);
  }

  /**
   * Full graph-backed context for UI and future AI.
   * @param {string} type
   * @param {string} id
   * @returns {EntityContext}
   */
  static getEntityContext(type, id) {
    GraphService.#ensureFresh();
    const entity = GraphService.getNode(type, id);
    if (!entity) {
      return {
        entity: null,
        foundryDocument: null,
        neighbors: [],
        incoming: [],
        outgoing: [],
        connectedActors: [],
        connectedItems: [],
        connectedLocations: [],
        connectedFactions: [],
        connectedStoryThreads: [],
        connectedQuests: [],
        connectedSessions: []
      };
    }

    const key = GraphService.#key(entity.type, entity.id);
    const outgoing = [...(GraphService.#outgoing.get(key) ?? [])]
      .map((edgeId) => GraphService.#edges.get(edgeId))
      .filter(Boolean);
    const incoming = [...(GraphService.#incoming.get(key) ?? [])]
      .map((edgeId) => GraphService.#edges.get(edgeId))
      .filter(Boolean);
    const neighbors = GraphService.getNeighbors(entity.type, entity.id);

    const byType = (want) =>
      neighbors.filter((node) => node.type === want);

    let foundryDocument = null;
    if (entity.foundry?.uuid) {
      foundryDocument = EntityRegistry.findByUUID(entity.foundry.uuid)?.document ?? null;
    } else if (entity.documentUuid) {
      foundryDocument = EntityRegistry.findByUUID(entity.documentUuid)?.document ?? null;
    }

    return {
      entity,
      foundryDocument,
      neighbors,
      incoming,
      outgoing,
      connectedActors: byType("actor"),
      connectedItems: byType("item"),
      connectedLocations: byType("location"),
      connectedFactions: byType("faction"),
      connectedStoryThreads: byType("storyThread"),
      connectedQuests: byType("quest"),
      connectedSessions: byType("session")
    };
  }

  /**
   * Portrait helper for UI: Foundry img or null (caller draws initials).
   * @param {string} type
   * @param {string} id
   * @returns {{ img: string, name: string, documentType: string }|null}
   */
  static getPortrait(type, id) {
    GraphService.#ensureFresh();
    const node = GraphService.getNode(type, id);
    if (!node) return null;
    const link = node.foundry ?? GraphService.#resolveFoundry(node);
    if (!link?.img) return null;
    return {
      img: link.img,
      name: link.name || node.name,
      documentType: link.documentType
    };
  }

  /**
   * Initials for avatar fallback.
   * @param {string} name
   * @returns {string}
   */
  static initials(name) {
    const parts = String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  /**
   * Map GraphService context into the legacy ContextEngine result shape so
   * RelationshipExplorer / ContextPanel keep working without dual logic.
   * @param {string} type
   * @param {string} id
   * @param {import("./context-engine.js").ContextResult} [base]
   */
  static toContextResult(type, id, base) {
    const ctx = GraphService.getEntityContext(type, id);
    const toNode = (graphNode) => ({
      kind: graphNode.type === "quest" ? "questEntry" : graphNode.type,
      id: graphNode.id,
      label: graphNode.name
    });

    const quests = ctx.connectedQuests.map(toNode);
    return {
      target: ctx.entity
        ? {
            kind: ctx.entity.type === "quest" ? "questEntry" : ctx.entity.type,
            id: ctx.entity.id,
            label: ctx.entity.name
          }
        : base?.target ?? null,
      lastSeen: base?.lastSeen ?? null,
      sessions:
        base?.sessions?.length
          ? base.sessions
          : ctx.connectedSessions.map((node) => ({
              kind: "session",
              id: node.id,
              label: node.name,
              sessionNumber: node.metadata?.sessionNumber ?? 0
            })),
      quests: [],
      questEntries: quests,
      actors: ctx.connectedActors.map(toNode),
      locations: ctx.connectedLocations.map(toNode),
      items: ctx.connectedItems.map(toNode),
      storyThreads: ctx.connectedStoryThreads.map(toNode),
      factions: ctx.connectedFactions.map(toNode),
      currentStatus: base?.currentStatus ?? "",
      campaignMemory: base?.campaignMemory ?? ""
    };
  }

  static #ensureFresh() {
    if (!GraphService.#ready) {
      GraphService.initialize();
      return;
    }
    if (
      GraphService.#docRevision !== CampaignDocument.revision ||
      GraphService.#linksRevision !== RelationshipService.revision()
    ) {
      GraphService.rebuild();
    }
  }

  static #inferDocumentEdges(doc) {
    for (const entry of doc.storyEntries ?? []) {
      const questKey = GraphService.#key("quest", entry.id);
      if (entry.storyThreadId) {
        GraphService.registerEdge({
          from: GraphService.#key("storyThread", entry.storyThreadId),
          to: questKey,
          type: GRAPH_EDGE_TYPE.CONTAINS,
          source: "campaignDocument"
        });
      }
      GraphService.#refEdges(questKey, "actor", entry.relatedCharacterIds);
      GraphService.#refEdges(questKey, "location", entry.relatedLocationIds);
      GraphService.#refEdges(questKey, "item", entry.relatedItemIds);
    }

    for (const thread of doc.storyThreads ?? []) {
      const threadKey = GraphService.#key("storyThread", thread.id);
      GraphService.#refEdges(threadKey, "actor", thread.relatedActorIds);
      GraphService.#refEdges(threadKey, "location", thread.relatedLocationIds);
      GraphService.#refEdges(threadKey, "item", thread.relatedItemIds);
      for (const questId of thread.relatedQuestIds ?? []) {
        GraphService.registerEdge({
          from: threadKey,
          to: GraphService.#key("quest", questId),
          type: GRAPH_EDGE_TYPE.REFERENCES,
          source: "campaignDocument"
        });
      }
    }

    for (const faction of doc.factions ?? []) {
      const factionKey = GraphService.#key("faction", faction.id);
      const actors = [
        ...(faction.leadershipActorIds ?? []),
        ...(faction.relatedActorIds ?? [])
      ];
      for (const actorId of actors) {
        if (!actorId) continue;
        GraphService.registerEdge({
          from: GraphService.#key("actor", actorId),
          to: factionKey,
          type: GRAPH_EDGE_TYPE.BELONGS_TO,
          source: "campaignDocument"
        });
      }
      GraphService.#refEdges(factionKey, "location", faction.relatedLocationIds);
      GraphService.#refEdges(factionKey, "item", faction.relatedItemIds);
      GraphService.#refEdges(factionKey, "storyThread", faction.relatedStoryThreadIds);
      for (const questId of faction.relatedQuestIds ?? []) {
        GraphService.registerEdge({
          from: factionKey,
          to: GraphService.#key("quest", questId),
          type: GRAPH_EDGE_TYPE.REFERENCES,
          source: "campaignDocument"
        });
      }
    }

    for (const session of doc.sessions ?? []) {
      if (session.status !== "completed") continue;
      const sessionKey = GraphService.#key("session", session.id);
      GraphService.#refEdges(sessionKey, "actor", session.relatedActors);
      GraphService.#refEdges(sessionKey, "location", session.relatedLocations);
      GraphService.#refEdges(sessionKey, "item", session.relatedItems);
      for (const entryId of session.relatedQuestEntries ?? []) {
        GraphService.registerEdge({
          from: sessionKey,
          to: GraphService.#key("quest", entryId),
          type: GRAPH_EDGE_TYPE.REFERENCES,
          source: "campaignDocument"
        });
      }
    }
  }

  /**
   * @param {string} fromKey
   * @param {string} type
   * @param {string[]|undefined} ids
   */
  static #refEdges(fromKey, type, ids) {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (!id) continue;
      GraphService.registerEdge({
        from: fromKey,
        to: GraphService.#key(type, id),
        type: GRAPH_EDGE_TYPE.REFERENCES,
        source: "campaignDocument"
      });
    }
  }

  /**
   * @param {GraphNode} node
   * @returns {{ uuid: string, documentType: string, img: string, name: string }|null}
   */
  static #resolveFoundry(node) {
    const key = GraphService.#key(node.type, node.id);
    if (GraphService.#foundryCache.has(key)) {
      const cached = GraphService.#foundryCache.get(key) ?? null;
      node.foundry = cached;
      return cached;
    }

    /** @type {{ uuid: string, documentType: string, img: string, name: string }|null} */
    let link = null;

    // 1. Stored UUID
    if (node.documentUuid) {
      const entity = EntityRegistry.findByUUID(node.documentUuid);
      if (entity) {
        link = {
          uuid: entity.uuid,
          documentType: entity.kind,
          img: entity.img || "",
          name: entity.name || node.name
        };
      }
    }

    // World nodes already are Foundry docs (id === uuid)
    if (!link && ["actor", "item", "location"].includes(node.type)) {
      const entity = EntityRegistry.findByUUID(node.id);
      if (entity) {
        link = {
          uuid: entity.uuid,
          documentType: entity.kind,
          img: entity.img || "",
          name: entity.name || node.name
        };
        node.documentUuid = entity.uuid;
      }
    }

    // 2. Exact name match (for campaign-owned nodes that may map to Foundry)
    if (!link && node.name) {
      const kindHint =
        node.type === "location"
          ? "scene"
          : ["actor", "item"].includes(node.type)
            ? node.type
            : undefined;
      const result = EntityRegistry.findByName(node.name, kindHint);
      if (result.status === "ok") {
        link = {
          uuid: result.entity.uuid,
          documentType: result.entity.kind,
          img: result.entity.img || "",
          name: result.entity.name || node.name
        };
        node.documentUuid = result.entity.uuid;
      }
    }

    // 3. Fuzzy match — future stub
    // (intentionally empty)

    GraphService.#foundryCache.set(key, link);
    node.foundry = link;
    return link;
  }

  static #ensureStub(key) {
    if (GraphService.#nodes.has(key)) return;
    const separator = key.indexOf(":");
    if (separator < 0) return;
    const type = key.slice(0, separator);
    const id = key.slice(separator + 1);
    let name = "Untitled";
    if (["actor", "item", "location"].includes(type)) {
      const entity = EntityRegistry.findByUUID(id);
      if (entity) name = entity.name;
    }
    GraphService.registerNode({ id, type, name, documentUuid: null, metadata: {} });
  }

  static #nodeKey(type, id) {
    const normalized = GraphService.#normalizeType(type);
    if (!normalized || !id) return null;
    return GraphService.#key(normalized, id);
  }

  static #key(type, id) {
    return `${type}:${id}`;
  }

  static #normalizeType(type) {
    if (!type) return null;
    if (type === "scene") return "location";
    if (type === "questEntry" || type === "beat") return "quest";
    return type;
  }
}
