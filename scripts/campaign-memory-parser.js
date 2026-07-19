import { EntityRegistry } from "./entity-registry.js";
import { PlaybookEntities } from "./playbook-entities.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { ThreadService } from "./thread-service.js";

/**
 * @typedef {"actor"|"quest"|"beat"|"scene"|"item"} MemoryMatchKind
 */

/**
 * @typedef {object} MemoryCandidate
 * @property {MemoryMatchKind} kind
 * @property {string} id
 * @property {string} name
 * @property {string} [label]
 */

/**
 * @typedef {object} MemoryMatchResolved
 * @property {"resolved"} status
 * @property {MemoryMatchKind} kind
 * @property {string} id
 * @property {string} name
 * @property {string} matchedText
 * @property {boolean} fromMention
 */

/**
 * @typedef {object} MemoryMatchAmbiguous
 * @property {"ambiguous"} status
 * @property {string} matchedText
 * @property {boolean} fromMention
 * @property {MemoryCandidate[]} candidates
 */

/**
 * @typedef {MemoryMatchResolved|MemoryMatchAmbiguous} MemoryMatch
 */

/**
 * Plain-text summary parser for Campaign Memory.
 * Matches existing objects only — never creates duplicates.
 */
export class CampaignMemoryParser {
  /**
   * Parse a plain-text summary into confident and ambiguous matches.
   * @param {string} summary
   * @returns {MemoryMatch[]}
   */
  static parse(summary) {
    const text = String(summary ?? "");
    if (!text.trim()) return [];

    /** @type {Map<string, MemoryMatch>} */
    const byKey = new Map();

    for (const mention of CampaignMemoryParser.#extractMentions(text)) {
      const match = CampaignMemoryParser.#resolveName(mention.name, {
        fromMention: true,
        preferredKind: mention.kind
      });
      if (!match) continue;
      CampaignMemoryParser.#merge(byKey, match);
    }

    const seenNames = new Set();
    const occupied = [];
    for (const candidate of CampaignMemoryParser.#catalog()) {
      const key = candidate.name.toLocaleLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      const ranges = CampaignMemoryParser.#findNameRanges(text, candidate.name)
        .filter((range) => !occupied.some(
          (used) => range.start < used.end && range.end > used.start
        ));
      if (!ranges.length) continue;
      occupied.push(...ranges);

      // Resolve across all kinds so same-name Actor/Item collisions ask for confirmation.
      const match = CampaignMemoryParser.#resolveName(candidate.name, {
        fromMention: false,
        preferredKind: null
      });
      if (!match) continue;
      CampaignMemoryParser.#merge(byKey, match);
    }

    return [...byKey.values()];
  }

  /**
   * Ask the GM to resolve one ambiguous match.
   * @param {MemoryMatchAmbiguous} match
   * @returns {Promise<MemoryCandidate|null>}
   */
  static async confirmAmbiguous(match) {
    if (!match?.candidates?.length) return null;

    const buttons = match.candidates.map((candidate, index) => ({
      action: `choice_${index}`,
      label: CampaignMemoryParser.#candidateLabel(candidate)
    }));
    buttons.push({
      action: "skip",
      label: "Skip",
      default: true
    });

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Confirm Chronicle Match" },
      content: `<p>Multiple matches for <strong>${foundry.utils.escapeHTML(match.matchedText)}</strong>. Choose one, or skip.</p>`,
      buttons,
      rejectClose: false,
      modal: true
    });

    if (typeof result !== "string" || !result.startsWith("choice_")) return null;
    const index = Number(result.slice("choice_".length));
    return Number.isInteger(index) ? match.candidates[index] ?? null : null;
  }

  /**
   * Collapse parser output into related* ID arrays after confirmations.
   * @param {MemoryMatch[]} matches
   * @returns {Promise<{
   *   relatedCharacterIds: string[],
   *   relatedQuestIds: string[],
   *   relatedBeatIds: string[],
   *   relatedLocationIds: string[],
   *   relatedItemIds: string[]
   * }>}
   */
  static async resolveReferences(matches) {
    /** @type {Set<string>} */
    const characters = new Set();
    /** @type {Set<string>} */
    const quests = new Set();
    /** @type {Set<string>} */
    const beats = new Set();
    /** @type {Set<string>} */
    const locations = new Set();
    /** @type {Set<string>} */
    const items = new Set();

    for (const match of matches) {
      /** @type {MemoryCandidate|null} */
      let chosen = null;
      if (match.status === "resolved") {
        chosen = { kind: match.kind, id: match.id, name: match.name };
      } else {
        chosen = await CampaignMemoryParser.confirmAmbiguous(match);
      }
      if (!chosen) continue;

      switch (chosen.kind) {
        case "actor":
          characters.add(chosen.id);
          break;
        case "quest":
          quests.add(chosen.id);
          break;
        case "beat":
          beats.add(chosen.id);
          break;
        case "scene":
          locations.add(chosen.id);
          break;
        case "item":
          items.add(chosen.id);
          break;
        default:
          break;
      }
    }

    return {
      relatedCharacterIds: [...characters],
      relatedQuestIds: [...quests],
      relatedBeatIds: [...beats],
      relatedLocationIds: [...locations],
      relatedItemIds: [...items]
    };
  }

  /**
   * @param {string} text
   * @returns {{ name: string, kind: MemoryMatchKind|null }[]}
   */
  static #extractMentions(text) {
    const mentions = [];
    const seen = new Set();
    for (const candidate of CampaignMemoryParser.#catalog()) {
      const name = candidate.name.trim();
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      const prefixed = `@${name}`;
      if (CampaignMemoryParser.#findNameRanges(text, prefixed).length) {
        mentions.push({ name, kind: null });
        seen.add(key);
      }
    }
    return mentions;
  }

  /**
   * Longest-name-first catalog of known campaign objects.
   * @returns {MemoryCandidate[]}
   */
  static #catalog() {
    /** @type {MemoryCandidate[]} */
    const catalog = [];

    for (const entity of EntityRegistry.all("actor")) {
      if (entity.name?.trim()) {
        catalog.push({ kind: "actor", id: entity.uuid, name: entity.name.trim() });
      }
    }
    for (const entity of EntityRegistry.all("scene")) {
      if (entity.name?.trim()) {
        catalog.push({ kind: "scene", id: entity.uuid, name: entity.name.trim() });
      }
    }
    for (const entity of EntityRegistry.all("item")) {
      if (entity.name?.trim()) {
        catalog.push({ kind: "item", id: entity.uuid, name: entity.name.trim() });
      }
    }
    for (const quest of ThreadService.list()) {
      const title = quest.title?.trim();
      if (title) catalog.push({ kind: "quest", id: quest.id, name: title });
    }
    for (const entry of QuestEntryService.list()) {
      const title = entry.title?.trim();
      if (title) catalog.push({ kind: "beat", id: entry.id, name: title });
    }

    return catalog.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));
  }

  /**
   * Case-insensitive whole-word / whole-phrase search.
   * @param {string} text
   * @param {string} name
   * @returns {{ start: number, end: number }[]}
   */
  static #findNameRanges(text, name) {
    const needle = String(name ?? "").trim();
    if (needle.length < 2) return [];

    const haystack = text.toLocaleLowerCase();
    const target = needle.toLocaleLowerCase();
    /** @type {{ start: number, end: number }[]} */
    const ranges = [];
    let from = 0;

    while (from <= haystack.length - target.length) {
      const index = haystack.indexOf(target, from);
      if (index < 0) break;
      const end = index + target.length;
      if (CampaignMemoryParser.#isBoundary(haystack, index, end)) {
        ranges.push({ start: index, end });
      }
      from = index + 1;
    }
    return ranges;
  }

  /**
   * @param {string} text
   * @param {number} start
   * @param {number} end
   */
  static #isBoundary(text, start, end) {
    const before = start === 0 ? "" : text[start - 1];
    const after = end >= text.length ? "" : text[end];
    const word = /[a-z0-9]/i;
    return !word.test(before) && !word.test(after);
  }

  /**
   * @param {string} name
   * @param {{ fromMention: boolean, preferredKind?: MemoryMatchKind|null }} options
   * @returns {MemoryMatch|null}
   */
  static #resolveName(name, options) {
    const needle = String(name ?? "").trim();
    if (!needle) return null;

    const candidates = CampaignMemoryParser.#candidatesFor(needle, options.preferredKind);
    if (!candidates.length) return null;

    if (candidates.length === 1) {
      const only = candidates[0];
      return {
        status: "resolved",
        kind: only.kind,
        id: only.id,
        name: only.name,
        matchedText: needle,
        fromMention: options.fromMention
      };
    }

    return {
      status: "ambiguous",
      matchedText: needle,
      fromMention: options.fromMention,
      candidates
    };
  }

  /**
   * @param {string} name
   * @param {MemoryMatchKind|null|undefined} preferredKind
   * @returns {MemoryCandidate[]}
   */
  static #candidatesFor(name, preferredKind) {
    const needle = name.trim().toLocaleLowerCase();
    /** @type {MemoryCandidate[]} */
    const hits = [];
    const kinds = preferredKind
      ? [preferredKind]
      : /** @type {MemoryMatchKind[]} */ (["actor", "quest", "beat", "scene", "item"]);

    for (const candidate of CampaignMemoryParser.#catalog()) {
      if (!kinds.includes(candidate.kind)) continue;
      if (candidate.name.toLocaleLowerCase() === needle) hits.push(candidate);
    }

    // Deduplicate identical kind+id pairs.
    const seen = new Set();
    return hits.filter((candidate) => {
      const key = `${candidate.kind}:${candidate.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Prefer resolved matches; keep ambiguous only when no resolved exists for same text+kind set.
   * @param {Map<string, MemoryMatch>} byKey
   * @param {MemoryMatch} match
   */
  static #merge(byKey, match) {
    const key =
      match.status === "resolved"
        ? `${match.kind}:${match.id}`
        : `ambiguous:${match.matchedText.toLocaleLowerCase()}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, match);
      return;
    }
    if (existing.status === "ambiguous" && match.status === "resolved") {
      byKey.set(key, match);
    }
  }

  /**
   * @param {MemoryCandidate} candidate
   * @returns {string}
   */
  static #candidateLabel(candidate) {
    const kindLabel = CampaignMemoryParser.#kindLabel(candidate.kind);
    if (candidate.kind === "actor" || candidate.kind === "scene" || candidate.kind === "item") {
      const entity = EntityRegistry.findByUUID(candidate.id);
      if (entity) {
        const labeled = PlaybookEntities.choiceLabel(entity);
        return labeled.includes("(") ? `${labeled} · ${kindLabel}` : `${labeled} (${kindLabel})`;
      }
    }
    return `${candidate.name} (${kindLabel})`;
  }

  /**
   * @param {MemoryMatchKind} kind
   */
  static #kindLabel(kind) {
    switch (kind) {
      case "actor":
        return "Actor";
      case "quest":
        return "Quest";
      case "beat":
        return "Scene";
      case "scene":
        return "Location";
      case "item":
        return "Item";
      default:
        return kind;
    }
  }
}
