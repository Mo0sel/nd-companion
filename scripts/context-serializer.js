/**
 * ContextSerializer — ContextEngine packets → prompt-ready markdown.
 *
 * Deterministic ordering, readable formatting, omits empty sections,
 * respects a configurable maximum size for future token budgeting.
 *
 * PromptBuilder is the only consumer; do not call LLMs from here.
 */

import { AISettings } from "./ai-settings.js";

const DEFAULT_INSTRUCTIONS = [
  "Use only the context provided below.",
  "If information is missing, say so instead of inventing details.",
  "Prefer concise, actionable answers for a live tabletop GM."
].join(" ");

/**
 * @typedef {object} SerializeOptions
 * @property {number} [maxChars]
 * @property {string} [instructions]
 * @property {string[]} [sectionOrder]
 */

/**
 * @typedef {object} SerializedContext
 * @property {string} markdown
 * @property {string[]} sections  Included section headings (without #)
 * @property {number} charCount
 * @property {number} estimatedTokens
 * @property {boolean} truncated
 */

export class ContextSerializer {
  /**
   * Lightweight token estimate (≈ chars / 4). Stretch-goal accuracy.
   * @param {string} text
   * @returns {number}
   */
  static estimateTokens(text) {
    const value = String(text ?? "");
    if (!value) return 0;
    return Math.max(1, Math.ceil(value.length / 4));
  }

  /**
   * @param {object} packet  EntityContextPacket
   * @param {SerializeOptions} [options]
   * @returns {SerializedContext}
   */
  static serializeEntity(packet, options = {}) {
    const entity = packet?.entity;
    const title = entity
      ? `${ContextSerializer.#labelType(entity.type)}: ${entity.name}`
      : "Unknown entity";

    return ContextSerializer.#assemble(
      [
        ["Campaign", ContextSerializer.#campaignLine()],
        ["Current Session", ContextSerializer.#sessionBlock(packet?.activeSessions?.[0])],
        ["Current Entity", ContextSerializer.#entityBlock(packet)],
        ["Status", ContextSerializer.#plain(packet?.status)],
        ["Notes", ContextSerializer.#plain(packet?.notes)],
        ["Timeline", ContextSerializer.#timeline(packet?.timeline ?? packet?.recentChronicleEvents)],
        ["Connected Knowledge", ContextSerializer.#nodeList(packet?.connectedKnowledge)],
        [
          "Related",
          ContextSerializer.#relatedGroups({
            Actors: packet?.relatedActors,
            Items: packet?.relatedItems,
            Locations: packet?.relatedLocations,
            Factions: packet?.relatedFactions,
            "Story Threads": packet?.relatedStoryThreads,
            Quests: packet?.relatedQuests
          })
        ],
        ["Graph Summary", ContextSerializer.#graphSummary(packet?.graphSummary)],
        ["Instructions", options.instructions ?? DEFAULT_INSTRUCTIONS]
      ],
      { ...options, titleHint: title }
    );
  }

  /**
   * @param {object} packet  SessionContextPacket
   * @param {SerializeOptions} [options]
   * @returns {SerializedContext}
   */
  static serializeSession(packet, options = {}) {
    return ContextSerializer.#assemble(
      [
        ["Campaign", ContextSerializer.#campaignLine()],
        ["Current Session", ContextSerializer.#sessionBlock(packet?.currentSession)],
        ["Active Story Threads", ContextSerializer.#namedList(packet?.activeStoryThreads)],
        ["Open Quests", ContextSerializer.#namedList(packet?.activeQuests)],
        ["Important NPCs", ContextSerializer.#nodeList(packet?.importantNPCs)],
        ["Important Locations", ContextSerializer.#nodeList(packet?.importantLocations)],
        ["Important Items", ContextSerializer.#nodeList(packet?.importantItems)],
        ["Recent Activity", ContextSerializer.#activity(packet?.recentlyUpdatedEntities)],
        ["Chronicle", ContextSerializer.#timeline(packet?.recentChronicle)],
        ["Graph Summary", ContextSerializer.#graphSummary(packet?.graphSummary)],
        ["Instructions", options.instructions ?? DEFAULT_INSTRUCTIONS]
      ],
      options
    );
  }

  /**
   * @param {object} packet  CampaignContextPacket
   * @param {SerializeOptions} [options]
   * @returns {SerializedContext}
   */
  static serializeCampaign(packet, options = {}) {
    const campaignName = packet?.campaign?.name?.trim() || ContextSerializer.#campaignLine();
    return ContextSerializer.#assemble(
      [
        ["Campaign", campaignName],
        ["Current Session", ContextSerializer.#sessionBlock(packet?.currentSession)],
        ["Active Story Threads", ContextSerializer.#namedList(packet?.activeThreads)],
        ["Completed Story Threads", ContextSerializer.#namedList(packet?.completedThreads)],
        ["Open Quests", ContextSerializer.#namedList(packet?.openQuests)],
        ["Completed Quests", ContextSerializer.#namedList(packet?.completedQuests)],
        ["Recently Changed", ContextSerializer.#activity(packet?.recentlyChanged)],
        ["Chronicle", ContextSerializer.#timeline(packet?.recentChronicle)],
        [
          "Graph Stats",
          ContextSerializer.#graphSummary(packet?.graphStats ?? packet?.graphSummary)
        ],
        ["Instructions", options.instructions ?? DEFAULT_INSTRUCTIONS]
      ],
      options
    );
  }

  /**
   * @param {object} packet  PlayContextPacket
   * @param {SerializeOptions} [options]
   * @returns {SerializedContext}
   */
  static serializePlay(packet, options = {}) {
    const beat = packet?.currentBeat;
    const beatBlock = beat
      ? [
          `- Title: ${beat.title || "Untitled beat"}`,
          `- Index: ${Number(beat.index) + 1} / ${beat.total}`,
          beat.sourceStoryThreadId ? `- Story Thread id: ${beat.sourceStoryThreadId}` : "",
          beat.sourceStoryEntryId ? `- Quest id: ${beat.sourceStoryEntryId}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    return ContextSerializer.#assemble(
      [
        ["Campaign", ContextSerializer.#campaignLine()],
        ["Current Session", ContextSerializer.#sessionBlock(packet?.currentSession)],
        ["Current Beat", beatBlock],
        ["Active Story Threads", ContextSerializer.#namedList(packet?.activeStoryThreads)],
        ["Open Quests", ContextSerializer.#namedList(packet?.activeQuests)],
        ["Important NPCs", ContextSerializer.#nodeList(packet?.importantNPCs)],
        ["Important Locations", ContextSerializer.#nodeList(packet?.importantLocations)],
        ["Important Items", ContextSerializer.#nodeList(packet?.importantItems)],
        ["Chronicle", ContextSerializer.#timeline(packet?.recentChronicle)],
        ["Graph Summary", ContextSerializer.#graphSummary(packet?.graphSummary)],
        ["Instructions", options.instructions ?? DEFAULT_INSTRUCTIONS]
      ],
      options
    );
  }

  /**
   * @param {Array<[string, string]>} sections
   * @param {SerializeOptions & { titleHint?: string }} options
   * @returns {SerializedContext}
   */
  static #assemble(sections, options = {}) {
    const maxChars =
      Number.isFinite(options.maxChars) && options.maxChars > 0
        ? Math.round(options.maxChars)
        : AISettings.maxContextSize();

    /** @type {string[]} */
    const included = [];
    /** @type {string[]} */
    const parts = [];
    let truncated = false;
    let used = 0;

    for (const [heading, body] of sections) {
      const text = String(body ?? "").trim();
      if (!text) continue;
      const block = `# ${heading}\n\n${text}`;
      const extra = parts.length ? 2 + block.length : block.length;
      if (used + extra > maxChars) {
        truncated = true;
        break;
      }
      parts.push(block);
      included.push(heading);
      used += extra;
    }

    let markdown = parts.join("\n\n");
    if (truncated) {
      const notice = "\n\n<!-- truncated to max context size -->";
      if (markdown.length + notice.length <= maxChars) {
        markdown += notice;
      }
    }

    return {
      markdown,
      sections: included,
      charCount: markdown.length,
      estimatedTokens: ContextSerializer.estimateTokens(markdown),
      truncated
    };
  }

  static #campaignLine() {
    return game.world?.title?.trim() || "Untitled Campaign";
  }

  static #plain(value) {
    const text = String(value ?? "").trim();
    return text;
  }

  static #labelType(type) {
    const map = {
      actor: "Actor",
      item: "Item",
      location: "Location",
      faction: "Faction",
      storyThread: "Story Thread",
      quest: "Quest",
      session: "Session"
    };
    return map[type] || type || "Entity";
  }

  static #entityBlock(packet) {
    const entity = packet?.entity;
    if (!entity) return "";
    const lines = [
      `- Type: ${ContextSerializer.#labelType(entity.type)}`,
      `- Name: ${entity.name || "Untitled"}`,
      `- Id: ${entity.id}`
    ];
    if (entity.documentUuid) lines.push(`- Document UUID: ${entity.documentUuid}`);
    if (packet?.foundry?.img) lines.push(`- Portrait: ${packet.foundry.img}`);
    if (entity.metadata && typeof entity.metadata === "object") {
      const meta = Object.entries(entity.metadata)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([k, v]) => `  - ${k}: ${v}`);
      if (meta.length) {
        lines.push("- Metadata:");
        lines.push(...meta);
      }
    }
    return lines.join("\n");
  }

  static #sessionBlock(session) {
    if (!session) return "";
    if (typeof session === "string") return session;
    const lines = [];
    if (session.sessionNumber != null) lines.push(`- Number: ${session.sessionNumber}`);
    if (session.title) lines.push(`- Title: ${session.title}`);
    if (session.status) lines.push(`- Status: ${session.status}`);
    if (session.id) lines.push(`- Id: ${session.id}`);
    if (session.name && !session.title) lines.push(`- Name: ${session.name}`);
    return lines.join("\n");
  }

  static #nodeList(nodes) {
    if (!Array.isArray(nodes) || !nodes.length) return "";
    return [...nodes]
      .map((node) => ({
        type: node.type || node.kind || "",
        name: node.name || node.label || "Untitled",
        id: node.id || ""
      }))
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type.localeCompare(b.type)
      )
      .map((node) => `- [${node.type}] ${node.name}${node.id ? ` (${node.id})` : ""}`)
      .join("\n");
  }

  static #namedList(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return [...items]
      .map((item) => ({
        name: item.name || item.title || item.label || "Untitled",
        status: item.status || "",
        id: item.id || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => {
        const status = item.status ? ` [${item.status}]` : "";
        const id = item.id ? ` (${item.id})` : "";
        return `- ${item.name}${status}${id}`;
      })
      .join("\n");
  }

  static #relatedGroups(groups) {
    const blocks = [];
    for (const [label, nodes] of Object.entries(groups)) {
      const list = ContextSerializer.#nodeList(nodes);
      if (!list) continue;
      blocks.push(`## ${label}\n${list}`);
    }
    return blocks.join("\n\n");
  }

  static #timeline(entries) {
    if (!Array.isArray(entries) || !entries.length) return "";
    return [...entries]
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const sn = (b.entry.sessionNumber ?? 0) - (a.entry.sessionNumber ?? 0);
        if (sn) return sn;
        return a.index - b.index;
      })
      .map(({ entry }) => {
        const label =
          entry.label ||
          entry.title ||
          (entry.sessionNumber != null ? `Session ${entry.sessionNumber}` : "Event");
        const excerpt = String(entry.excerpt || entry.sessionLog || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 240);
        return excerpt ? `- ${label}: ${excerpt}` : `- ${label}`;
      })
      .join("\n");
  }

  static #activity(events) {
    if (!Array.isArray(events) || !events.length) return "";
    return [...events]
      .map((event) => {
        const name = event.entityName || event.entityId || "Unknown";
        const kind = event.entityKind || "entity";
        const action = event.action || "updated";
        const field = event.fieldName ? ` · ${event.fieldName}` : "";
        return `- ${action} [${kind}] ${name}${field}`;
      })
      .join("\n");
  }

  static #graphSummary(summary) {
    if (!summary || typeof summary !== "object") return "";
    const lines = [];
    if (summary.nodeCount != null) lines.push(`- Nodes: ${summary.nodeCount}`);
    if (summary.edgeCount != null) lines.push(`- Edges: ${summary.edgeCount}`);
    if (summary.relationshipCount != null) {
      lines.push(`- Relationships: ${summary.relationshipCount}`);
    }
    if (summary.connectedEntityCount != null) {
      lines.push(`- Connected entities: ${summary.connectedEntityCount}`);
    }
    return lines.join("\n");
  }
}
