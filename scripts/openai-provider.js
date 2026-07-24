import { AIProvider } from "./ai-provider.js";
import { AISettings } from "./ai-settings.js";

/**
 * OpenAI provider stub — registered for settings UI / future use.
 * Does not perform network requests.
 */
export class OpenAIProvider extends AIProvider {
  constructor() {
    super("openai", "OpenAI");
  }

  /** @returns {import("./ai-provider.js").AIModelInfo} */
  getModelInfo() {
    return {
      id: this.id,
      label: this.label,
      provider: this.id,
      models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
      supportsStreaming: true
    };
  }

  async healthCheck() {
    const settings = AISettings.get();
    if (settings.provider !== "openai") {
      return { ok: false, message: "OpenAI is not the active provider." };
    }
    if (!settings.apiKey.trim()) {
      return { ok: false, message: "OpenAI API key is not configured (client setting)." };
    }
    if (!settings.model.trim()) {
      return { ok: false, message: "OpenAI model is not configured." };
    }
    return {
      ok: true,
      message: "OpenAI settings look complete. Remote calls remain disabled this sprint."
    };
  }
}
