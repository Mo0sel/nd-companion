/**
 * AI Settings panel — client-scoped provider configuration.
 * No LLM calls. API keys never touch Campaign storage.
 */

import { AIProviderRegistry } from "./ai-provider-registry.js";
import { AISettings } from "./ai-settings.js";

export class AISettingsPanel {
  /**
   * @param {HTMLElement} container
   */
  static paint(container) {
    if (!(container instanceof HTMLElement)) return;
    const settings = AISettings.get();
    const providers = AIProviderRegistry.listProviders();

    const form = document.createElement("form");
    form.className = "nd-ai-settings";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void AISettingsPanel.#save(form);
    });

    form.append(
      AISettingsPanel.#note(
        "AI settings are stored on this Foundry client only. They are never exported with Campaign data. LLM calls are disabled this sprint."
      )
    );

    const providerSelect = AISettingsPanel.#select(
      "provider",
      "Provider",
      [
        { value: "none", label: "None (disabled)" },
        ...providers.map((p) => ({ value: p.id, label: p.label }))
      ],
      settings.provider
    );
    form.append(providerSelect.wrap);

    const modelInput = AISettingsPanel.#text(
      "model",
      "Model",
      settings.model,
      "e.g. gpt-4o-mini or claude-sonnet-4-5"
    );
    form.append(modelInput.wrap);

    const modelHints = document.createElement("p");
    modelHints.className = "nd-ai-settings__hint";
    modelHints.dataset.aiModelHints = "";
    form.append(modelHints);

    const keyInput = AISettingsPanel.#text(
      "apiKey",
      "API Key",
      settings.apiKey,
      "Stored locally on this client",
      "password"
    );
    form.append(keyInput.wrap);

    form.append(
      AISettingsPanel.#number("temperature", "Temperature", settings.temperature, 0, 2, 0.1)
        .wrap
    );
    form.append(
      AISettingsPanel.#number(
        "maxContextSize",
        "Max Context Size (chars)",
        settings.maxContextSize,
        1000,
        200000,
        500
      ).wrap
    );
    form.append(
      AISettingsPanel.#number("timeoutMs", "Timeout (ms)", settings.timeoutMs, 1000, 300000, 1000)
        .wrap
    );

    const streaming = document.createElement("label");
    streaming.className = "nd-ai-settings__check";
    const streamingInput = document.createElement("input");
    streamingInput.type = "checkbox";
    streamingInput.name = "streaming";
    streamingInput.checked = settings.streaming === true;
    streaming.append(streamingInput, document.createTextNode(" Enable streaming (future)"));
    form.append(streaming);

    const actions = document.createElement("div");
    actions.className = "nd-ai-settings__actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "nd-campaign-save";
    save.textContent = "Save AI Settings";
    const health = document.createElement("button");
    health.type = "button";
    health.textContent = "Health Check";
    health.addEventListener("click", () => {
      void AISettingsPanel.#health();
    });
    actions.append(save, health);
    form.append(actions);

    const status = document.createElement("p");
    status.className = "nd-ai-settings__status";
    status.dataset.aiSettingsStatus = "";
    form.append(status);

    container.replaceChildren(form);
    AISettingsPanel.#updateModelHints(form);
    providerSelect.input.addEventListener("change", () => {
      AISettingsPanel.#updateModelHints(form);
    });
  }

  /**
   * @param {HTMLFormElement} form
   */
  static async #save(form) {
    const data = new FormData(form);
    const next = await AISettings.set({
      provider: String(data.get("provider") || "none"),
      model: String(data.get("model") || ""),
      apiKey: String(data.get("apiKey") || ""),
      temperature: Number(data.get("temperature")),
      maxContextSize: Number(data.get("maxContextSize")),
      timeoutMs: Number(data.get("timeoutMs")),
      streaming: form.querySelector('input[name="streaming"]')?.checked === true
    });
    AIProviderRegistry.syncFromSettings();
    const status = form.querySelector("[data-ai-settings-status]");
    if (status instanceof HTMLElement) {
      status.textContent = `Saved. Active provider: ${next.provider}.`;
    }
    ui.notifications?.info("AI settings saved (client only).");
  }

  static async #health() {
    AIProviderRegistry.syncFromSettings();
    const active = AIProviderRegistry.getActive();
    if (!active) {
      ui.notifications?.warn("No AI provider selected.");
      return;
    }
    const result = await active.healthCheck();
    if (result.ok) ui.notifications?.info(result.message);
    else ui.notifications?.warn(result.message);
  }

  /**
   * @param {HTMLFormElement} form
   */
  static #updateModelHints(form) {
    const select = form.querySelector('select[name="provider"]');
    const hints = form.querySelector("[data-ai-model-hints]");
    if (!(select instanceof HTMLSelectElement) || !(hints instanceof HTMLElement)) return;
    const provider = AIProviderRegistry.get(select.value);
    const models = provider?.getModelInfo()?.models ?? [];
    hints.textContent = models.length
      ? `Suggested models: ${models.join(", ")}`
      : "Select a provider to see suggested models.";
  }

  static #note(text) {
    const p = document.createElement("p");
    p.className = "nd-ai-settings__note";
    p.textContent = text;
    return p;
  }

  static #fieldWrap(labelText, input) {
    const wrap = document.createElement("label");
    wrap.className = "nd-ai-settings__field";
    const span = document.createElement("span");
    span.textContent = labelText;
    wrap.append(span, input);
    return { wrap, input };
  }

  static #text(name, label, value, placeholder = "", type = "text") {
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.value = value ?? "";
    if (placeholder) input.placeholder = placeholder;
    input.autocomplete = "off";
    return AISettingsPanel.#fieldWrap(label, input);
  }

  static #number(name, label, value, min, max, step) {
    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    return AISettingsPanel.#fieldWrap(label, input);
  }

  static #select(name, label, options, value) {
    const input = document.createElement("select");
    input.name = name;
    for (const option of options) {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      if (option.value === value) el.selected = true;
      input.append(el);
    }
    return AISettingsPanel.#fieldWrap(label, input);
  }
}
