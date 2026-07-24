/**
 * Session Wrap-Up orchestration:
 * SessionCollector → PromptBuilder → AIProvider → validated proposal
 */

import { AILogger } from "./ai-logger.js";
import { AIProviderRegistry } from "./ai-provider-registry.js";
import { CampaignUpdater } from "./campaign-updater.js";
import { PromptBuilder } from "./prompt-builder.js";
import { SessionCollector } from "./session-collector.js";

export class SessionWrapUp {
  /**
   * Collect + ask the model for structured wrap-up JSON.
   * @returns {Promise<{
   *   ok: boolean,
   *   error?: string,
   *   collection?: object,
   *   built?: object,
   *   proposal?: object,
   *   rawText?: string,
   *   meta?: object
   * }>}
   */
  static async generateProposal() {
    AIProviderRegistry.syncFromSettings();
    const provider = AIProviderRegistry.getActive();
    if (!provider) {
      return {
        ok: false,
        error: "No AI provider selected. Configure AI Settings first."
      };
    }

    const collection = await SessionCollector.collect();
    if (!collection.session) {
      return { ok: false, error: "There is no active session to wrap up." };
    }

    const built = PromptBuilder.buildSessionWrapUpPrompt(collection);
    const started = Date.now();
    try {
      const generated = await provider.generate(built.prompt, { stream: false });
      const rawText = String(generated?.text ?? "").trim();
      const parsed = SessionWrapUp.#parseJson(rawText);
      if (!parsed.ok) {
        AILogger.log({
          action: "sessionWrapUp",
          provider: provider.id,
          model: generated?.meta?.model || "",
          promptChars: built.charCount,
          promptTokensEst: built.estimatedTokens,
          contextPacketChars: JSON.stringify(collection).length,
          latencyMs: Date.now() - started,
          responseChars: rawText.length,
          ok: false,
          error: parsed.error
        });
        return {
          ok: false,
          error: parsed.error,
          collection,
          built,
          rawText,
          meta: generated?.meta
        };
      }

      const validated = CampaignUpdater.validateProposal(parsed.value);
      if (!validated.ok) {
        return {
          ok: false,
          error: validated.error,
          collection,
          built,
          rawText,
          meta: generated?.meta
        };
      }

      AILogger.log({
        action: "sessionWrapUp",
        provider: provider.id,
        model: generated?.meta?.model || "",
        promptChars: built.charCount,
        promptTokensEst: built.estimatedTokens,
        contextPacketChars: JSON.stringify(collection).length,
        latencyMs: generated?.meta?.latencyMs ?? Date.now() - started,
        responseChars: rawText.length,
        responseTokens: generated?.meta?.responseTokens ?? null,
        ok: true
      });

      return {
        ok: true,
        collection,
        built,
        proposal: validated.proposal,
        rawText,
        meta: generated?.meta
      };
    } catch (error) {
      const message = error?.message || String(error);
      AILogger.log({
        action: "sessionWrapUp",
        provider: provider.id,
        model: "",
        promptChars: built.charCount,
        promptTokensEst: built.estimatedTokens,
        contextPacketChars: JSON.stringify(collection).length,
        latencyMs: Date.now() - started,
        responseChars: 0,
        ok: false,
        error: message
      });
      return { ok: false, error: message, collection, built };
    }
  }

  /**
   * @param {string} text
   * @returns {{ ok: true, value: unknown }|{ ok: false, error: string }}
   */
  static #parseJson(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return { ok: false, error: "Empty model response." };

    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    const candidate = fence ? fence[1].trim() : trimmed;
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch (_error) {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
        } catch (_inner) {
          /* fall through */
        }
      }
      return { ok: false, error: "Model response was not valid JSON." };
    }
  }
}
