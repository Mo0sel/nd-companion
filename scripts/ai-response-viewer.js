/**
 * Reusable AI response viewer — markdown, copy, regenerate, loading, errors, meta.
 */

import { MarkdownLite } from "./markdown-lite.js";

export class AIResponseViewer {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   onRegenerate?: () => void|Promise<void>
   * }} [options]
   */
  static paint(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const root = document.createElement("div");
    root.className = "nd-ai-response";
    root.dataset.aiResponse = "";

    const meta = document.createElement("div");
    meta.className = "nd-ai-response__meta";
    meta.dataset.aiResponseMeta = "";

    const status = document.createElement("div");
    status.className = "nd-ai-response__status";
    status.dataset.aiResponseStatus = "";
    status.hidden = true;

    const body = document.createElement("div");
    body.className = "nd-ai-response__body nd-richtext";
    body.dataset.aiResponseBody = "";

    const actions = document.createElement("div");
    actions.className = "nd-ai-response__actions";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.dataset.aiResponseCopy = "";

    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.textContent = "Regenerate";
    regenerate.dataset.aiResponseRegen = "";
    regenerate.disabled = true;

    actions.append(copy, regenerate);
    root.append(meta, status, body, actions);
    container.replaceChildren(root);

    copy.addEventListener("click", async () => {
      const text = root.dataset.aiResponseText || body.innerText || "";
      try {
        await navigator.clipboard.writeText(text);
        ui.notifications?.info("Response copied.");
      } catch (error) {
        console.error("N&D Companion: copy failed", error);
        ui.notifications?.error("Could not copy response.");
      }
    });

    regenerate.addEventListener("click", () => {
      if (typeof options.onRegenerate === "function") {
        void options.onRegenerate();
      }
    });

    AIResponseViewer.setIdle(root);
  }

  /**
   * @param {HTMLElement} root
   */
  static setIdle(root) {
    const host = AIResponseViewer.#host(root);
    if (!host) return;
    host.dataset.aiResponseText = "";
    AIResponseViewer.#meta(host).textContent = "";
    const status = AIResponseViewer.#status(host);
    status.hidden = true;
    status.textContent = "";
    status.classList.remove("is-error", "is-loading");
    AIResponseViewer.#body(host).innerHTML =
      "<p class=\"nd-ai-response__placeholder\">Choose an action to begin.</p>";
    const regen = host.querySelector("[data-ai-response-regen]");
    if (regen instanceof HTMLButtonElement) regen.disabled = true;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} [label]
   */
  static setLoading(root, label = "Thinking…") {
    const host = AIResponseViewer.#host(root);
    if (!host) return;
    const status = AIResponseViewer.#status(host);
    status.hidden = false;
    status.classList.add("is-loading");
    status.classList.remove("is-error");
    status.textContent = label;
    AIResponseViewer.#body(host).innerHTML =
      "<p class=\"nd-ai-response__placeholder\">Working…</p>";
    const regen = host.querySelector("[data-ai-response-regen]");
    if (regen instanceof HTMLButtonElement) regen.disabled = true;
  }

  /**
   * @param {HTMLElement} root
   * @param {string} message
   */
  static setError(root, message) {
    const host = AIResponseViewer.#host(root);
    if (!host) return;
    const status = AIResponseViewer.#status(host);
    status.hidden = false;
    status.classList.remove("is-loading");
    status.classList.add("is-error");
    status.textContent = message || "Request failed.";
    AIResponseViewer.#body(host).innerHTML = "";
    const regen = host.querySelector("[data-ai-response-regen]");
    if (regen instanceof HTMLButtonElement) regen.disabled = false;
  }

  /**
   * @param {HTMLElement} root
   * @param {{
   *   text: string,
   *   title?: string,
   *   meta?: {
   *     provider?: string,
   *     model?: string,
   *     latencyMs?: number,
   *     promptTokensEst?: number,
   *     responseTokens?: number|null
   *   }
   * }} result
   */
  static setResult(root, result) {
    const host = AIResponseViewer.#host(root);
    if (!host) return;
    const text = String(result?.text ?? "");
    host.dataset.aiResponseText = text;

    const status = AIResponseViewer.#status(host);
    status.hidden = true;
    status.classList.remove("is-loading", "is-error");

    const meta = result?.meta ?? {};
    const bits = [];
    if (result?.title) bits.push(result.title);
    if (meta.model) bits.push(`Model: ${meta.model}`);
    if (meta.provider) bits.push(`Provider: ${meta.provider}`);
    if (Number.isFinite(meta.latencyMs)) bits.push(`${meta.latencyMs} ms`);
    if (Number.isFinite(meta.promptTokensEst)) {
      bits.push(`~${meta.promptTokensEst} prompt tokens`);
    }
    if (meta.responseTokens != null && Number.isFinite(meta.responseTokens)) {
      bits.push(`~${meta.responseTokens} response tokens`);
    }
    AIResponseViewer.#meta(host).textContent = bits.join(" · ");

    AIResponseViewer.#body(host).innerHTML = MarkdownLite.toSafeHtml(text);
    const regen = host.querySelector("[data-ai-response-regen]");
    if (regen instanceof HTMLButtonElement) regen.disabled = false;
  }

  /**
   * @param {HTMLElement} root
   * @returns {HTMLElement|null}
   */
  static #host(root) {
    if (!(root instanceof HTMLElement)) return null;
    return root.matches("[data-ai-response]")
      ? root
      : root.querySelector("[data-ai-response]");
  }

  static #meta(host) {
    return host.querySelector("[data-ai-response-meta]");
  }

  static #status(host) {
    return host.querySelector("[data-ai-response-status]");
  }

  static #body(host) {
    return host.querySelector("[data-ai-response-body]");
  }
}
