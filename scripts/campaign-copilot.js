/**
 * Campaign Copilot — first AI feature (retrieval / summarization / explanation).
 *
 * Architecture:
 *   ContextEngine → PromptBuilder → AIProvider → response
 *
 * Forgotten Threads is deterministic (no LLM). Providers never read campaign data.
 */

import { AILogger } from "./ai-logger.js";
import { AIProviderRegistry } from "./ai-provider-registry.js";
import { AISettings } from "./ai-settings.js";
import { ContextEngine } from "./context-engine.js";
import { GraphService } from "./graph-service.js";
import { PromptBuilder } from "./prompt-builder.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * @typedef {object} CopilotResult
 * @property {string} action
 * @property {string} title
 * @property {string} text
 * @property {boolean} ok
 * @property {string|null} error
 * @property {import("./prompt-builder.js").BuiltPrompt|null} built
 * @property {{
 *   provider: string,
 *   model: string,
 *   latencyMs: number,
 *   promptTokensEst: number,
 *   responseTokens: number|null,
 *   local?: boolean
 * }} meta
 */

export class CampaignCopilot {
  /**
   * @param {string} type
   * @param {string} id
   * @returns {Promise<CopilotResult>}
   */
  static explainEntity(type, id) {
    return CampaignCopilot.#runAi({
      action: "explainEntity",
      title: "Explain Entity",
      build: () => PromptBuilder.buildExplainEntityPrompt(type, id)
    });
  }

  /**
   * @returns {Promise<CopilotResult>}
   */
  static campaignSummary() {
    return CampaignCopilot.#runAi({
      action: "campaignSummary",
      title: "Campaign Summary",
      build: () => PromptBuilder.buildCampaignSummaryPrompt()
    });
  }

  /**
   * @returns {Promise<CopilotResult>}
   */
  static sessionRecap() {
    return CampaignCopilot.#runAi({
      action: "sessionRecap",
      title: "Session Recap",
      build: () => PromptBuilder.buildSessionRecapPrompt()
    });
  }

  /**
   * @param {string} question
   * @returns {Promise<CopilotResult>}
   */
  static searchCampaign(question) {
    return CampaignCopilot.#runAi({
      action: "searchCampaign",
      title: "Search Campaign",
      build: () => PromptBuilder.buildSearchPrompt(question)
    });
  }

  /**
   * Deterministic staleness report — no LLM.
   * @param {number} [minGap=5]
   * @returns {CopilotResult}
   */
  static forgottenThreads(minGap = 5) {
    const gap = Math.max(1, Math.trunc(Number(minGap) || 5));
    const current = CampaignCopilot.#currentSessionNumber();
    const items = CampaignCopilot.#collectForgotten(current, gap);
    const text = CampaignCopilot.#formatForgotten(items, current, gap);
    const result = {
      action: "forgottenThreads",
      title: "Forgotten Threads",
      text,
      ok: true,
      error: null,
      built: null,
      meta: {
        provider: "local",
        model: "deterministic",
        latencyMs: 0,
        promptTokensEst: 0,
        responseTokens: PromptBuilder.estimateTokens(text),
        local: true
      }
    };
    AILogger.log({
      action: result.action,
      provider: "local",
      model: "deterministic",
      promptChars: 0,
      promptTokensEst: 0,
      contextPacketChars: 0,
      latencyMs: 0,
      responseChars: text.length,
      responseTokens: result.meta.responseTokens,
      ok: true
    });
    return result;
  }

  /**
   * @param {{
   *   action: string,
   *   title: string,
   *   build: () => import("./prompt-builder.js").BuiltPrompt
   * }} spec
   * @returns {Promise<CopilotResult>}
   */
  static async #runAi(spec) {
    AIProviderRegistry.syncFromSettings();
    const provider = AIProviderRegistry.getActive();
    const settings = AISettings.get();

    /** @type {import("./prompt-builder.js").BuiltPrompt|null} */
    let built = null;
    try {
      if (!provider) {
        throw new Error(
          "No AI provider selected. Open AI Settings and choose OpenAI (with an API key)."
        );
      }
      built = spec.build();
      const started = Date.now();
      const packetChars = built.packet ? JSON.stringify(built.packet).length : 0;
      const generated = await provider.generate(built.prompt);
      const text = String(generated?.text ?? "").trim();
      if (!text) throw new Error("The provider returned an empty response.");

      const meta = {
        provider: generated?.meta?.provider || provider.id,
        model: generated?.meta?.model || settings.model || provider.id,
        latencyMs: generated?.meta?.latencyMs ?? Date.now() - started,
        promptTokensEst:
          generated?.meta?.promptTokensEst ?? built.estimatedTokens,
        responseTokens:
          generated?.meta?.responseTokens ?? PromptBuilder.estimateTokens(text),
        local: false
      };

      AILogger.log({
        action: spec.action,
        provider: meta.provider,
        model: meta.model,
        promptChars: built.charCount,
        promptTokensEst: meta.promptTokensEst,
        contextPacketChars: packetChars,
        latencyMs: meta.latencyMs,
        responseChars: text.length,
        responseTokens: meta.responseTokens,
        ok: true
      });

      return {
        action: spec.action,
        title: spec.title,
        text,
        ok: true,
        error: null,
        built,
        meta
      };
    } catch (error) {
      const message = error?.message || String(error);
      AILogger.log({
        action: spec.action,
        provider: provider?.id || settings.provider || "none",
        model: settings.model || "",
        promptChars: built?.charCount ?? 0,
        promptTokensEst: built?.estimatedTokens ?? 0,
        contextPacketChars: built?.packet ? JSON.stringify(built.packet).length : 0,
        latencyMs: 0,
        responseChars: 0,
        responseTokens: null,
        ok: false,
        error: message
      });
      return {
        action: spec.action,
        title: spec.title,
        text: "",
        ok: false,
        error: message,
        built,
        meta: {
          provider: provider?.id || settings.provider || "none",
          model: settings.model || "",
          latencyMs: 0,
          promptTokensEst: built?.estimatedTokens ?? 0,
          responseTokens: null,
          local: false
        }
      };
    }
  }

  /**
   * @returns {number}
   */
  static #currentSessionNumber() {
    const active = SessionService.getActive();
    if (active?.sessionNumber) return Number(active.sessionNumber) || 1;
    const completed = SessionService.list()
      .filter((session) => session.status === "completed")
      .map((session) => Number(session.sessionNumber) || 0);
    return completed.length ? Math.max(...completed) : 1;
  }

  /**
   * @param {number} currentSession
   * @param {number} minGap
   * @returns {{ type: string, id: string, name: string, lastSession: number|null, gap: number|null }[]}
   */
  static #collectForgotten(currentSession, minGap) {
    /** @type {Map<string, { type: string, id: string, name: string, lastSession: number|null }>} */
    const map = new Map();

    const remember = (type, id, name, sessionNumber) => {
      if (!type || !id) return;
      const key = `${type}:${id}`;
      const existing = map.get(key);
      const sn =
        Number.isFinite(sessionNumber) && sessionNumber > 0
          ? Number(sessionNumber)
          : null;
      if (!existing) {
        map.set(key, {
          type,
          id,
          name: name || "Untitled",
          lastSession: sn
        });
        return;
      }
      if (sn != null && (existing.lastSession == null || sn > existing.lastSession)) {
        existing.lastSession = sn;
      }
      if (name && (!existing.name || existing.name === "Untitled")) {
        existing.name = name;
      }
    };

    for (const thread of StoryThreadService.list()) {
      remember(
        "storyThread",
        thread.id,
        thread.title?.trim() || "Untitled Story Thread",
        null
      );
    }

    const campaign = ContextEngine.getCampaignContext();
    for (const thread of [...(campaign.activeThreads ?? []), ...(campaign.completedThreads ?? [])]) {
      remember("storyThread", thread.id, thread.name, null);
    }

    // Seed related world entities from story-thread neighbors
    for (const thread of StoryThreadService.list()) {
      for (const neighbor of GraphService.getNeighbors("storyThread", thread.id)) {
        if (["actor", "location", "item"].includes(neighbor.type)) {
          remember(neighbor.type, neighbor.id, neighbor.name, null);
        }
      }
    }

    // Update last-seen from entity timelines
    for (const entry of map.values()) {
      if (entry.type === "storyThread") {
        const packet = ContextEngine.getEntityContext("storyThread", entry.id);
        const last = packet?.timeline?.[0]?.sessionNumber;
        if (Number.isFinite(last)) entry.lastSession = Number(last);
        continue;
      }
      const packet = ContextEngine.getEntityContext(entry.type, entry.id);
      const last = packet?.timeline?.[0]?.sessionNumber;
      if (Number.isFinite(last)) entry.lastSession = Number(last);
    }

    return [...map.values()]
      .map((item) => {
        const gap =
          item.lastSession == null
            ? null
            : Math.max(0, currentSession - item.lastSession);
        return { ...item, gap };
      })
      .filter((item) => item.lastSession == null || (item.gap ?? 0) >= minGap)
      .sort((a, b) => {
        if (a.lastSession == null && b.lastSession != null) return -1;
        if (a.lastSession != null && b.lastSession == null) return 1;
        return (b.gap ?? 0) - (a.gap ?? 0) || a.name.localeCompare(b.name);
      });
  }

  /**
   * @param {{ type: string, id: string, name: string, lastSession: number|null, gap: number|null }[]} items
   * @param {number} currentSession
   * @param {number} minGap
   * @returns {string}
   */
  static #formatForgotten(items, currentSession, minGap) {
    const lines = [
      `# Forgotten Threads`,
      ``,
      `Current session marker: ${currentSession}`,
      `Threshold: not referenced in ${minGap}+ sessions (or never referenced).`,
      ``
    ];
    if (!items.length) {
      lines.push("No forgotten NPCs, locations, items, or story threads found at this threshold.");
      return lines.join("\n");
    }

    const groups = {
      storyThread: "Story Threads",
      actor: "NPCs",
      location: "Locations",
      item: "Items"
    };
    for (const [type, label] of Object.entries(groups)) {
      const subset = items.filter((item) => item.type === type);
      if (!subset.length) continue;
      lines.push(`## ${label}`);
      for (const item of subset) {
        const stale =
          item.lastSession == null
            ? "never referenced in chronicle timeline"
            : `last seen session ${item.lastSession} (${item.gap} sessions ago)`;
        lines.push(`- **${item.name}** — ${stale}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }
}
