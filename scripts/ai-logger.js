/**
 * Developer-facing AI request logging (no secrets, no prompt bodies).
 * Enable verbose logs with: window.nd.debugAI = true
 */

export class AILogger {
  /**
   * @param {object} entry
   */
  static log(entry) {
    if (!game?.user?.isGM && window.nd?.debugAI !== true) return;

    const safe = {
      action: entry.action ?? "",
      provider: entry.provider ?? "",
      model: entry.model ?? "",
      promptChars: Number(entry.promptChars) || 0,
      promptTokensEst: Number(entry.promptTokensEst) || 0,
      contextPacketChars: Number(entry.contextPacketChars) || 0,
      latencyMs: Number(entry.latencyMs) || 0,
      responseChars: Number(entry.responseChars) || 0,
      responseTokens: entry.responseTokens ?? null,
      ok: entry.ok !== false,
      error: entry.error ? String(entry.error).slice(0, 200) : null
    };

    console.debug("N&D Companion AI", safe);
  }
}
