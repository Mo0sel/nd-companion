/**
 * PromptBuilder — ContextEngine packets → deterministic prompts.
 *
 * Never calls an LLM. Never reads Campaign data directly.
 * Always: ContextEngine → ContextSerializer → prompt string.
 */

import { AISettings } from "./ai-settings.js";
import { ContextEngine } from "./context-engine.js";
import { ContextSerializer } from "./context-serializer.js";

/**
 * @typedef {object} PromptBuildOptions
 * @property {number} [maxChars]
 * @property {string} [instructions]
 */

/**
 * @typedef {object} BuiltPrompt
 * @property {string} type  entity | session | campaign | play | search
 * @property {string} prompt
 * @property {string[]} sections
 * @property {number} charCount
 * @property {number} estimatedTokens
 * @property {boolean} truncated
 * @property {object} packet  Source ContextEngine packet (for debugging)
 */

const NO_INVENT =
  "Answer using ONLY the campaign context below. If something is unknown or missing, say so. Do not invent names, events, motives, or relationships.";

const EXPLAIN_ENTITY = [
  NO_INVENT,
  "Summarize this entity for a live GM:",
  "- What this entity is",
  "- Why it matters right now",
  "- Recent events (from timeline/chronicle)",
  "- Current status",
  "- Known relationships",
  "Be concise. No creative additions."
].join("\n");

const CAMPAIGN_SUMMARY = [
  NO_INVENT,
  "Produce a Campaign Summary with these sections:",
  "- Campaign overview",
  "- Major conflicts",
  "- Important NPCs",
  "- Current objectives",
  "- Open mysteries",
  "- Recent developments",
  "Use only the provided context."
].join("\n");

const SESSION_RECAP = [
  NO_INVENT,
  "Produce a Session Recap with these sections:",
  "- Major events",
  "- Player decisions",
  "- Consequences",
  "- Loose ends",
  "Prefer the current session, chronicle, and recent activity. Do not invent scenes."
].join("\n");

export class PromptBuilder {
  /**
   * @param {string} text
   * @returns {number}
   */
  static estimateTokens(text) {
    return ContextSerializer.estimateTokens(text);
  }

  /**
   * Serialize an arbitrary ContextEngine packet (advanced / debug).
   * @param {"entity"|"session"|"campaign"|"play"} kind
   * @param {object} packet
   * @param {PromptBuildOptions} [options]
   */
  static serialize(kind, packet, options = {}) {
    const opts = PromptBuilder.#options(options);
    switch (kind) {
      case "entity":
        return ContextSerializer.serializeEntity(packet, opts);
      case "session":
        return ContextSerializer.serializeSession(packet, opts);
      case "campaign":
        return ContextSerializer.serializeCampaign(packet, opts);
      case "play":
        return ContextSerializer.serializePlay(packet, opts);
      default:
        throw new Error(`PromptBuilder.serialize: unknown kind ${kind}`);
    }
  }

  /**
   * @param {string|{ kind?: string, type?: string, id?: string, uuid?: string }} typeOrRef
   * @param {string} [id]
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildEntityPrompt(typeOrRef, id, options = {}) {
    const packet = ContextEngine.getEntityContext(typeOrRef, id);
    const serialized = ContextSerializer.serializeEntity(
      packet,
      PromptBuilder.#options(options)
    );
    return PromptBuilder.#result("entity", serialized, packet);
  }

  /**
   * Explain Entity — same context packet, task-specific instructions.
   * @param {string|{ kind?: string, type?: string, id?: string, uuid?: string }} typeOrRef
   * @param {string} [id]
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildExplainEntityPrompt(typeOrRef, id, options = {}) {
    return PromptBuilder.buildEntityPrompt(typeOrRef, id, {
      ...options,
      instructions: options.instructions ?? EXPLAIN_ENTITY
    });
  }

  /**
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildSessionPrompt(options = {}) {
    const packet = ContextEngine.getSessionContext();
    const serialized = ContextSerializer.serializeSession(
      packet,
      PromptBuilder.#options(options)
    );
    return PromptBuilder.#result("session", serialized, packet);
  }

  /**
   * Session Recap task prompt.
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildSessionRecapPrompt(options = {}) {
    return PromptBuilder.buildSessionPrompt({
      ...options,
      instructions: options.instructions ?? SESSION_RECAP
    });
  }

  /**
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildCampaignPrompt(options = {}) {
    const packet = ContextEngine.getCampaignContext();
    const serialized = ContextSerializer.serializeCampaign(
      packet,
      PromptBuilder.#options(options)
    );
    return PromptBuilder.#result("campaign", serialized, packet);
  }

  /**
   * Campaign Summary task prompt.
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildCampaignSummaryPrompt(options = {}) {
    return PromptBuilder.buildCampaignPrompt({
      ...options,
      instructions: options.instructions ?? CAMPAIGN_SUMMARY
    });
  }

  /**
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildPlayPrompt(options = {}) {
    const packet = ContextEngine.getPlayContext();
    const serialized = ContextSerializer.serializePlay(
      packet,
      PromptBuilder.#options(options)
    );
    return PromptBuilder.#result("play", serialized, packet);
  }

  /**
   * Natural-language campaign search — campaign context + question.
   * @param {string} question
   * @param {PromptBuildOptions} [options]
   * @returns {BuiltPrompt}
   */
  static buildSearchPrompt(question, options = {}) {
    const query = String(question ?? "").trim();
    if (!query) {
      throw new Error("Search question is empty.");
    }
    const packet = ContextEngine.getCampaignContext();
    const instructions = [
      NO_INVENT,
      `GM question: ${query}`,
      "Answer only from the campaign context below.",
      "If the answer is not present, say you cannot find it in the campaign records."
    ].join("\n");
    const serialized = ContextSerializer.serializeCampaign(
      packet,
      PromptBuilder.#options({ ...options, instructions })
    );
    return PromptBuilder.#result("search", serialized, packet);
  }

  /**
   * @param {PromptBuildOptions} [options]
   * @returns {PromptBuildOptions}
   */
  static #options(options = {}) {
    return {
      maxChars:
        Number.isFinite(options.maxChars) && options.maxChars > 0
          ? Math.round(options.maxChars)
          : AISettings.maxContextSize(),
      instructions: options.instructions
    };
  }

  /**
   * @param {BuiltPrompt["type"]} type
   * @param {import("./context-serializer.js").SerializedContext} serialized
   * @param {object} packet
   * @returns {BuiltPrompt}
   */
  static #result(type, serialized, packet) {
    return {
      type,
      prompt: serialized.markdown,
      sections: [...serialized.sections],
      charCount: serialized.charCount,
      estimatedTokens: serialized.estimatedTokens,
      truncated: serialized.truncated,
      packet
    };
  }
}
