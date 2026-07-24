/**
 * AIProvider — abstract interface for LLM communication.
 *
 * Nothing outside AIProvider subclasses may talk to an LLM.
 * Providers must never read Campaign data directly.
 */

/**
 * @typedef {object} AIModelInfo
 * @property {string} id
 * @property {string} label
 * @property {string} provider
 * @property {string[]} models
 * @property {boolean} supportsStreaming
 */

/**
 * @typedef {object} AIHealthResult
 * @property {boolean} ok
 * @property {string} message
 */

/**
 * @typedef {object} AIGenerateResult
 * @property {string} text
 * @property {{
 *   provider: string,
 *   model: string,
 *   latencyMs: number,
 *   promptTokensEst?: number,
 *   responseTokens?: number|null,
 *   usage?: object|null,
 *   streamed?: boolean
 * }} [meta]
 */

export class AIProvider {
  /**
   * @param {string} id
   * @param {string} label
   */
  constructor(id, label) {
    this.id = id;
    this.label = label;
  }

  /**
   * @param {string} _prompt
   * @param {object} [_options]
   * @returns {Promise<AIGenerateResult>}
   */
  async generate(_prompt, _options = {}) {
    throw new Error(`${this.label}: generate() is not implemented.`);
  }

  /**
   * @param {string} _prompt
   * @param {object} [_options]
   * @returns {AsyncGenerator<string, void, unknown>}
   */
  async *stream(_prompt, _options = {}) {
    throw new Error(`${this.label}: stream() is not implemented.`);
  }

  /**
   * @returns {Promise<AIHealthResult>}
   */
  async healthCheck() {
    return {
      ok: false,
      message: `${this.label}: healthCheck() is not implemented.`
    };
  }

  /**
   * @returns {AIModelInfo}
   */
  getModelInfo() {
    return {
      id: this.id,
      label: this.label,
      provider: this.id,
      models: [],
      supportsStreaming: false
    };
  }
}
