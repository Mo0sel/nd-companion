import { AIProvider } from "./ai-provider.js";
import { AISettings } from "./ai-settings.js";
import { PromptBuilder } from "./prompt-builder.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * OpenAI provider — Responses API.
 * Reads API key only from client AI settings. Never touches campaign data.
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
    return {
      ok: true,
      message: `OpenAI ready (model: ${OpenAIProvider.#model(settings)}).`
    };
  }

  /**
   * @param {string} prompt
   * @param {object} [options]
   * @returns {Promise<import("./ai-provider.js").AIGenerateResult>}
   */
  async generate(prompt, options = {}) {
    const settings = AISettings.get();
    OpenAIProvider.#assertReady(settings);
    const model = OpenAIProvider.#model(settings);
    const started = Date.now();

    if (settings.streaming && options.stream !== false) {
      let text = "";
      for await (const chunk of this.stream(prompt, options)) {
        text += chunk;
      }
      return {
        text,
        meta: {
          provider: this.id,
          model,
          latencyMs: Date.now() - started,
          promptTokensEst: PromptBuilder.estimateTokens(prompt),
          responseTokens: PromptBuilder.estimateTokens(text),
          streamed: true
        }
      };
    }

    const body = {
      model,
      input: String(prompt ?? ""),
      temperature: settings.temperature,
      store: false
    };

    const data = await OpenAIProvider.#requestJson(body, settings);
    const text = OpenAIProvider.#extractText(data);
    const usage = data?.usage ?? null;
    return {
      text,
      meta: {
        provider: this.id,
        model,
        latencyMs: Date.now() - started,
        promptTokensEst: PromptBuilder.estimateTokens(prompt),
        responseTokens:
          usage?.output_tokens ??
          usage?.outputTokens ??
          PromptBuilder.estimateTokens(text),
        usage,
        streamed: false
      }
    };
  }

  /**
   * @param {string} prompt
   * @param {object} [options]
   * @returns {AsyncGenerator<string, void, unknown>}
   */
  async *stream(prompt, options = {}) {
    const settings = AISettings.get();
    OpenAIProvider.#assertReady(settings);
    const model = OpenAIProvider.#model(settings);
    const body = {
      model,
      input: String(prompt ?? ""),
      temperature: settings.temperature,
      store: false,
      stream: true
    };

    const response = await OpenAIProvider.#fetch(body, settings);
    if (!response.body) {
      const data = await response.json();
      const text = OpenAIProvider.#extractText(data);
      if (text) yield text;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event;
        try {
          event = JSON.parse(payload);
        } catch (_error) {
          continue;
        }
        const delta = OpenAIProvider.#streamDelta(event);
        if (delta) yield delta;
        void options;
      }
    }
  }

  /**
   * @param {import("./ai-settings.js").AISettingsState} settings
   */
  static #assertReady(settings) {
    if (!settings.apiKey.trim()) {
      throw new Error("OpenAI API key is not configured. Open AI Settings first.");
    }
  }

  /**
   * @param {import("./ai-settings.js").AISettingsState} settings
   * @returns {string}
   */
  static #model(settings) {
    return settings.model.trim() || DEFAULT_MODEL;
  }

  /**
   * @param {object} body
   * @param {import("./ai-settings.js").AISettingsState} settings
   */
  static async #requestJson(body, settings) {
    const response = await OpenAIProvider.#fetch(body, settings);
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error("OpenAI returned a non-JSON response.");
    }
    return data;
  }

  /**
   * @param {object} body
   * @param {import("./ai-settings.js").AISettingsState} settings
   * @returns {Promise<Response>}
   */
  static async #fetch(body, settings) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
    try {
      const response = await fetch(RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        let message = `OpenAI request failed (${response.status})`;
        try {
          const data = await response.json();
          message = data?.error?.message || data?.message || message;
        } catch (_error) {
          /* keep status message */
        }
        throw new Error(message);
      }
      return response;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${settings.timeoutMs}ms.`);
      }
      throw new Error(error?.message || "OpenAI network request failed.");
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param {object} data
   * @returns {string}
   */
  static #extractText(data) {
    if (!data || typeof data !== "object") return "";
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }
    /** @type {string[]} */
    const parts = [];
    for (const item of data.output ?? []) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "message") {
        for (const content of item.content ?? []) {
          if (
            content?.type === "output_text" &&
            typeof content.text === "string" &&
            content.text
          ) {
            parts.push(content.text);
          }
        }
      }
    }
    return parts.join("\n").trim();
  }

  /**
   * @param {object} event
   * @returns {string}
   */
  static #streamDelta(event) {
    if (!event || typeof event !== "object") return "";
    if (typeof event.delta === "string") return event.delta;
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      return event.delta;
    }
    if (typeof event.text === "string") return event.text;
    return "";
  }
}
