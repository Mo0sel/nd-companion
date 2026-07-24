/**
 * AIProvider — abstract interface for LLM communication.
 *
 * Nothing outside AIProvider subclasses may talk to an LLM.
 * Sprint 13: infrastructure only — no network calls are made.
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
 * @property {object} [meta]
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
    throw new Error(`${this.label}: generate() is not enabled (AI platform infrastructure only).`);
  }

  /**
   * @param {string} _prompt
   * @param {object} [_options]
   * @returns {AsyncIterable<string>}
   */
  async *stream(_prompt, _options = {}) {
    throw new Error(`${this.label}: stream() is not enabled (AI platform infrastructure only).`);
  }

  /**
   * Local readiness check — must not call remote APIs in Sprint 13.
   * @returns {Promise<AIHealthResult>}
   */
  async healthCheck() {
    return {
      ok: false,
      message: `${this.label}: LLM calls are disabled in this sprint.`
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
