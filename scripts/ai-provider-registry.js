/**
 * AIProviderRegistry — select the active LLM provider without app coupling.
 */

import { AISettings } from "./ai-settings.js";
import { ClaudeProvider } from "./claude-provider.js";
import { OpenAIProvider } from "./openai-provider.js";

export class AIProviderRegistry {
  /** @type {Map<string, import("./ai-provider.js").AIProvider>} */
  static #providers = new Map();

  /** @type {string} */
  static #activeId = "none";

  /** @type {boolean} */
  static #ready = false;

  /** Register built-in providers and sync active id from AI settings. */
  static initialize() {
    if (AIProviderRegistry.#ready) {
      AIProviderRegistry.syncFromSettings();
      return;
    }
    AIProviderRegistry.register(new OpenAIProvider());
    AIProviderRegistry.register(new ClaudeProvider());
    AIProviderRegistry.#ready = true;
    AIProviderRegistry.syncFromSettings();
  }

  /**
   * @param {import("./ai-provider.js").AIProvider} provider
   */
  static register(provider) {
    if (!provider?.id) throw new Error("AIProviderRegistry.register requires provider.id");
    AIProviderRegistry.#providers.set(provider.id, provider);
  }

  /**
   * @param {string} id
   */
  static setActive(id) {
    if (id === "none") {
      AIProviderRegistry.#activeId = "none";
      return;
    }
    if (!AIProviderRegistry.#providers.has(id)) {
      throw new Error(`Unknown AI provider: ${id}`);
    }
    AIProviderRegistry.#activeId = id;
  }

  /**
   * @returns {import("./ai-provider.js").AIProvider|null}
   */
  static getActive() {
    if (AIProviderRegistry.#activeId === "none") return null;
    return AIProviderRegistry.#providers.get(AIProviderRegistry.#activeId) ?? null;
  }

  /**
   * @param {string} id
   * @returns {import("./ai-provider.js").AIProvider|null}
   */
  static get(id) {
    return AIProviderRegistry.#providers.get(id) ?? null;
  }

  /**
   * @returns {{ id: string, label: string, info: import("./ai-provider.js").AIModelInfo }[]}
   */
  static listProviders() {
    return [...AIProviderRegistry.#providers.values()].map((provider) => ({
      id: provider.id,
      label: provider.label,
      info: provider.getModelInfo()
    }));
  }

  /** Align active provider with client AI settings (no network). */
  static syncFromSettings() {
    const settings = AISettings.get();
    if (settings.provider === "none" || !AIProviderRegistry.#providers.has(settings.provider)) {
      AIProviderRegistry.#activeId = "none";
      return;
    }
    AIProviderRegistry.#activeId = settings.provider;
  }
}
