/**
 * Prompt Preview — developer-only panel.
 * Builds prompts via PromptBuilder; never calls an LLM.
 */

import { CampaignWorkspace } from "./campaign-workspace.js";
import { FocusManager } from "./focus-manager.js";
import { PromptBuilder } from "./prompt-builder.js";

const PROMPT_TYPES = [
  { id: "play", label: "Play" },
  { id: "session", label: "Session" },
  { id: "campaign", label: "Campaign" },
  { id: "entity", label: "Entity (focus)" }
];

export class PromptPreviewPanel {
  /**
   * @param {HTMLElement} container
   */
  static paint(container) {
    if (!(container instanceof HTMLElement)) return;

    const root = document.createElement("div");
    root.className = "nd-prompt-preview";

    const toolbar = document.createElement("div");
    toolbar.className = "nd-prompt-preview__toolbar";

    const typeSelect = document.createElement("select");
    typeSelect.dataset.promptType = "";
    typeSelect.setAttribute("aria-label", "Prompt type");
    for (const type of PROMPT_TYPES) {
      const option = document.createElement("option");
      option.value = type.id;
      option.textContent = type.label;
      typeSelect.append(option);
    }

    const rebuild = document.createElement("button");
    rebuild.type = "button";
    rebuild.textContent = "Rebuild";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";

    toolbar.append(typeSelect, rebuild, copy);

    const meta = document.createElement("div");
    meta.className = "nd-prompt-preview__meta";
    meta.dataset.promptMeta = "";

    const sections = document.createElement("div");
    sections.className = "nd-prompt-preview__sections";
    sections.dataset.promptSections = "";
    sections.setAttribute("aria-label", "Included sections");

    const pre = document.createElement("pre");
    pre.className = "nd-prompt-preview__body";
    pre.dataset.promptBody = "";

    root.append(toolbar, meta, sections, pre);
    container.replaceChildren(root);

    const refresh = () => PromptPreviewPanel.#rebuild(root);
    typeSelect.addEventListener("change", refresh);
    rebuild.addEventListener("click", refresh);
    copy.addEventListener("click", async () => {
      const text = pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        ui.notifications?.info("Prompt copied.");
      } catch (error) {
        console.error("N&D Companion: prompt copy failed", error);
        ui.notifications?.error("Could not copy prompt.");
      }
    });

    refresh();
  }

  /**
   * @param {HTMLElement} root
   */
  static #rebuild(root) {
    const typeSelect = root.querySelector("[data-prompt-type]");
    const meta = root.querySelector("[data-prompt-meta]");
    const sectionsEl = root.querySelector("[data-prompt-sections]");
    const body = root.querySelector("[data-prompt-body]");
    if (
      !(typeSelect instanceof HTMLSelectElement) ||
      !(meta instanceof HTMLElement) ||
      !(sectionsEl instanceof HTMLElement) ||
      !(body instanceof HTMLElement)
    ) {
      return;
    }

    const type = typeSelect.value;
    /** @type {import("./prompt-builder.js").BuiltPrompt} */
    let built;
    try {
      built = PromptPreviewPanel.#build(type);
    } catch (error) {
      console.error("N&D Companion: prompt preview failed", error);
      meta.textContent = "Build failed — see console.";
      sectionsEl.replaceChildren();
      body.textContent = String(error?.message ?? error);
      return;
    }

    meta.textContent =
      `Type: ${built.type} · Chars: ${built.charCount} · ` +
      `~Tokens: ${built.estimatedTokens}` +
      (built.truncated ? " · Truncated" : "");

    sectionsEl.replaceChildren();
    for (const name of built.sections) {
      const chip = document.createElement("span");
      chip.className = "nd-prompt-preview__chip";
      chip.textContent = name;
      sectionsEl.append(chip);
    }
    if (!built.sections.length) {
      const empty = document.createElement("span");
      empty.className = "nd-prompt-preview__empty";
      empty.textContent = "No sections";
      sectionsEl.append(empty);
    }

    body.textContent = built.prompt || "(empty prompt)";
  }

  /**
   * @param {string} type
   * @returns {import("./prompt-builder.js").BuiltPrompt}
   */
  static #build(type) {
    switch (type) {
      case "session":
        return PromptBuilder.buildSessionPrompt();
      case "campaign":
        return PromptBuilder.buildCampaignPrompt();
      case "play":
        return PromptBuilder.buildPlayPrompt();
      case "entity": {
        const target = PromptPreviewPanel.#resolveFocus();
        if (!target) {
          const message =
            "# Instructions\n\nNo focused entity. Open one in Campaign (or control a token), then Rebuild.";
          return {
            type: "entity",
            prompt: message,
            sections: ["Instructions"],
            charCount: message.length,
            estimatedTokens: PromptBuilder.estimateTokens(message),
            truncated: false,
            packet: null
          };
        }
        return PromptBuilder.buildEntityPrompt(target.type, target.id);
      }
      default:
        throw new Error(`Unknown prompt type: ${type}`);
    }
  }

  /**
   * @returns {{ type: string, id: string }|null}
   */
  static #resolveFocus() {
    const campaign = CampaignWorkspace.getFocusTarget?.();
    if (campaign?.kind && campaign?.id) {
      return { type: campaign.kind, id: campaign.id };
    }
    const focus = FocusManager.get();
    if (focus?.kind === "actor" && focus.uuid) {
      return { type: "actor", id: focus.uuid };
    }
    return null;
  }
}
