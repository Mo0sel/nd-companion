/**
 * AI settings — client-scoped only.
 * Never stored in Campaign data or campaign export payloads.
 */

import { CompanionStorage } from "./storage.js";

const SETTING_KEY = "aiSettings";

/** @typedef {"openai"|"claude"|"none"} AIProviderId */

/**
 * @typedef {object} AISettingsState
 * @property {AIProviderId} provider
 * @property {string} model
 * @property {string} apiKey
 * @property {number} temperature
 * @property {number} maxContextSize
 * @property {boolean} streaming
 * @property {number} timeoutMs
 */

/** @type {AISettingsState} */
export const AI_SETTINGS_DEFAULTS = Object.freeze({
  provider: "none",
  model: "",
  apiKey: "",
  temperature: 0.2,
  maxContextSize: 12000,
  streaming: false,
  timeoutMs: 60000
});

export class AISettings {
  /** Register the client setting during module init. */
  static register() {
    CompanionStorage.registerAISettings();
  }

  /**
   * @returns {AISettingsState}
   */
  static get() {
    return AISettings.#normalize(CompanionStorage.getAISettings());
  }

  /**
   * @param {Partial<AISettingsState>} patch
   * @returns {Promise<AISettingsState>}
   */
  static async set(patch) {
    const next = AISettings.#normalize({ ...AISettings.get(), ...(patch ?? {}) });
    await CompanionStorage.setAISettings(next);
    return next;
  }

  /**
   * Max prompt characters / approximate tokens budget for serializers.
   * @returns {number}
   */
  static maxContextSize() {
    return AISettings.get().maxContextSize;
  }

  /**
   * @param {unknown} raw
   * @returns {AISettingsState}
   */
  static #normalize(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const provider =
      src.provider === "openai" || src.provider === "claude" || src.provider === "none"
        ? src.provider
        : AI_SETTINGS_DEFAULTS.provider;
    const temperature = Number(src.temperature);
    const maxContextSize = Number(src.maxContextSize);
    const timeoutMs = Number(src.timeoutMs);
    return {
      provider,
      model: String(src.model ?? AI_SETTINGS_DEFAULTS.model).trim(),
      apiKey: String(src.apiKey ?? ""),
      temperature: Number.isFinite(temperature)
        ? Math.min(2, Math.max(0, temperature))
        : AI_SETTINGS_DEFAULTS.temperature,
      maxContextSize: Number.isFinite(maxContextSize)
        ? Math.min(200000, Math.max(1000, Math.round(maxContextSize)))
        : AI_SETTINGS_DEFAULTS.maxContextSize,
      streaming: src.streaming === true,
      timeoutMs: Number.isFinite(timeoutMs)
        ? Math.min(300000, Math.max(1000, Math.round(timeoutMs)))
        : AI_SETTINGS_DEFAULTS.timeoutMs
    };
  }
}

// Re-export key for storage registration helpers.
export { SETTING_KEY as AI_SETTINGS_KEY };
