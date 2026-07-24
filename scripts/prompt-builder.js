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
 * @property {string} type  entity | session | campaign | play
 * @property {string} prompt
 * @property {string[]} sections
 * @property {number} charCount
 * @property {number} estimatedTokens
 * @property {boolean} truncated
 * @property {object} packet  Source ContextEngine packet (for debugging)
 */

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
