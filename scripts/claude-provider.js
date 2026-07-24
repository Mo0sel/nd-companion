import { AIProvider } from "./ai-provider.js";
import { AISettings } from "./ai-settings.js";

/**
 * Claude (Anthropic) provider stub — registered for settings UI / future use.
 * Does not perform network requests.
 */
export class ClaudeProvider extends AIProvider {
  constructor() {
    super("claude", "Claude");
  }

  /** @returns {import("./ai-provider.js").AIModelInfo} */
  getModelInfo() {
    return {
      id: this.id,
      label: this.label,
      provider: this.id,
      models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
      supportsStreaming: true
    };
  }

  async healthCheck() {
    const settings = AISettings.get();
    if (settings.provider !== "claude") {
      return { ok: false, message: "Claude is not the active provider." };
    }
    if (!settings.apiKey.trim()) {
      return { ok: false, message: "Claude API key is not configured (client setting)." };
    }
    if (!settings.model.trim()) {
      return { ok: false, message: "Claude model is not configured." };
    }
    return {
      ok: true,
      message: "Claude settings look complete. Remote calls remain disabled this sprint."
    };
  }
}
