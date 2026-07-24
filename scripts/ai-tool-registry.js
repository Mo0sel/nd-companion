/**
 * ToolRegistry — metadata for future AI-callable read-only tools.
 *
 * Sprint 13: register descriptors only. Do not execute tools for the AI yet.
 */

/**
 * @typedef {object} AIToolParameter
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} [required]
 */

/**
 * @typedef {object} AIToolDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {"read"} access
 * @property {AIToolParameter[]} parameters
 * @property {string} returns
 */

/** @type {AIToolDefinition[]} */
const BUILTIN_TOOLS = [
  {
    id: "findEntity",
    name: "findEntity",
    description: "Find a campaign entity (actor, item, location, faction) by id or name.",
    access: "read",
    parameters: [
      { name: "type", type: "string", description: "Entity type", required: true },
      { name: "query", type: "string", description: "Id, UUID, or name", required: true }
    ],
    returns: "Entity summary or null"
  },
  {
    id: "findQuest",
    name: "findQuest",
    description: "Find a quest / story entry by id or title.",
    access: "read",
    parameters: [
      { name: "query", type: "string", description: "Id or title", required: true }
    ],
    returns: "Quest summary or null"
  },
  {
    id: "findStoryThread",
    name: "findStoryThread",
    description: "Find a story thread by id or title.",
    access: "read",
    parameters: [
      { name: "query", type: "string", description: "Id or title", required: true }
    ],
    returns: "Story thread summary or null"
  },
  {
    id: "findRelationships",
    name: "findRelationships",
    description: "List relationships for an entity.",
    access: "read",
    parameters: [
      { name: "type", type: "string", description: "Entity type", required: true },
      { name: "id", type: "string", description: "Entity id", required: true }
    ],
    returns: "Relationship list"
  },
  {
    id: "searchChronicle",
    name: "searchChronicle",
    description: "Search chronicle / campaign memory text.",
    access: "read",
    parameters: [
      { name: "query", type: "string", description: "Search text", required: true }
    ],
    returns: "Matching chronicle excerpts"
  },
  {
    id: "getTimeline",
    name: "getTimeline",
    description: "Timeline of sessions / chronicle events for an entity.",
    access: "read",
    parameters: [
      { name: "type", type: "string", description: "Entity type", required: true },
      { name: "id", type: "string", description: "Entity id", required: true }
    ],
    returns: "Timeline entries"
  },
  {
    id: "listActiveThreads",
    name: "listActiveThreads",
    description: "List ACTIVE story threads.",
    access: "read",
    parameters: [],
    returns: "Story thread list"
  },
  {
    id: "listOpenQuests",
    name: "listOpenQuests",
    description: "List open (ACTIVE / PLANNED) quests.",
    access: "read",
    parameters: [],
    returns: "Quest list"
  },
  {
    id: "getSessionContext",
    name: "getSessionContext",
    description: "Return the current session context packet (via ContextEngine).",
    access: "read",
    parameters: [],
    returns: "SessionContextPacket"
  },
  {
    id: "getCampaignContext",
    name: "getCampaignContext",
    description: "Return the campaign context packet (via ContextEngine).",
    access: "read",
    parameters: [],
    returns: "CampaignContextPacket"
  }
];

export class ToolRegistry {
  /** @type {Map<string, AIToolDefinition>} */
  static #tools = new Map();

  /** @type {boolean} */
  static #ready = false;

  static initialize() {
    if (ToolRegistry.#ready) return;
    for (const tool of BUILTIN_TOOLS) {
      ToolRegistry.register(tool);
    }
    ToolRegistry.#ready = true;
  }

  /**
   * @param {AIToolDefinition} definition
   */
  static register(definition) {
    if (!definition?.id) throw new Error("ToolRegistry.register requires id");
    ToolRegistry.#tools.set(definition.id, {
      ...definition,
      access: "read",
      parameters: Array.isArray(definition.parameters) ? [...definition.parameters] : [],
      name: definition.name || definition.id,
      description: definition.description || "",
      returns: definition.returns || ""
    });
  }

  /**
   * @param {string} id
   * @returns {AIToolDefinition|null}
   */
  static get(id) {
    return ToolRegistry.#tools.get(id) ?? null;
  }

  /**
   * @returns {AIToolDefinition[]}
   */
  static list() {
    return [...ToolRegistry.#tools.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Metadata only — execution is intentionally unimplemented this sprint.
   * @param {string} id
   * @param {object} [_args]
   */
  static async execute(id, _args = {}) {
    const tool = ToolRegistry.get(id);
    if (!tool) throw new Error(`Unknown tool: ${id}`);
    throw new Error(
      `Tool "${tool.name}" is registered but execution is not enabled (Sprint 13).`
    );
  }
}
