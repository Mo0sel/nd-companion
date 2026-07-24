/**
 * Campaign Copilot panel — action cards, not a free-form chatbot.
 */

import { AIResponseViewer } from "./ai-response-viewer.js";
import { CampaignCopilot } from "./campaign-copilot.js";
import { CampaignWorkspace } from "./campaign-workspace.js";
import { FocusManager } from "./focus-manager.js";

const ACTIONS = [
  {
    id: "explainEntity",
    title: "Explain Entity",
    blurb: "Summarize the focused entity from campaign context."
  },
  {
    id: "sessionRecap",
    title: "Session Recap",
    blurb: "Major events, decisions, consequences, and loose ends."
  },
  {
    id: "searchCampaign",
    title: "Search Campaign",
    blurb: "Ask a question answered only from campaign records."
  },
  {
    id: "whatChanged",
    title: "What Changed?",
    blurb: "Recent campaign activity and developments."
  },
  {
    id: "forgottenThreads",
    title: "Forgotten Threads",
    blurb: "NPCs, places, items, and threads gone quiet."
  },
  {
    id: "campaignSummary",
    title: "Campaign Summary",
    blurb: "Overview, conflicts, NPCs, objectives, mysteries."
  }
];

export class CampaignCopilotPanel {
  /** @type {{ action: string, args?: object }|null} */
  static #lastRequest = null;

  /**
   * @param {HTMLElement} container
   * @param {{ focus?: { type: string, id: string }|null }} [options]
   */
  static paint(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;

    const root = document.createElement("div");
    root.className = "nd-copilot";

    const intro = document.createElement("p");
    intro.className = "nd-copilot__intro";
    intro.textContent =
      "Campaign Copilot answers from ContextEngine packets only. It will not invent campaign facts.";

    const cards = document.createElement("div");
    cards.className = "nd-copilot__cards";
    cards.setAttribute("role", "list");

    for (const action of ACTIONS) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "nd-copilot__card";
      card.dataset.copilotAction = action.id;
      card.setAttribute("role", "listitem");
      const title = document.createElement("span");
      title.className = "nd-copilot__card-title";
      title.textContent = action.title;
      const blurb = document.createElement("span");
      blurb.className = "nd-copilot__card-blurb";
      blurb.textContent = action.blurb;
      card.append(title, blurb);
      cards.append(card);
    }

    const search = document.createElement("div");
    search.className = "nd-copilot__search";
    search.hidden = true;
    search.dataset.copilotSearch = "";
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Who knows about the Mask?";
    input.setAttribute("aria-label", "Campaign search question");
    input.dataset.copilotSearchInput = "";
    const ask = document.createElement("button");
    ask.type = "button";
    ask.textContent = "Ask";
    ask.dataset.copilotSearchAsk = "";
    search.append(input, ask);

    const viewerHost = document.createElement("div");
    viewerHost.dataset.copilotViewer = "";

    root.append(intro, cards, search, viewerHost);
    container.replaceChildren(root);

    AIResponseViewer.paint(viewerHost, {
      onRegenerate: () => CampaignCopilotPanel.#regenerate(root, options)
    });

    if (options.focus?.type && options.focus?.id) {
      CampaignCopilotPanel.#lastRequest = {
        action: "explainEntity",
        args: { type: options.focus.type, id: options.focus.id }
      };
      void CampaignCopilotPanel.#execute(root, CampaignCopilotPanel.#lastRequest);
    }

    cards.addEventListener("click", (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("[data-copilot-action]")
        : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const action = button.dataset.copilotAction;
      if (!action) return;

      const searchBox = root.querySelector("[data-copilot-search]");
      if (searchBox instanceof HTMLElement) {
        searchBox.hidden = action !== "searchCampaign";
      }

      if (action === "searchCampaign") {
        const field = root.querySelector("[data-copilot-search-input]");
        if (field instanceof HTMLInputElement) field.focus();
        return;
      }

      const request = CampaignCopilotPanel.#requestFor(action, options);
      if (!request) return;
      CampaignCopilotPanel.#lastRequest = request;
      void CampaignCopilotPanel.#execute(root, request);
    });

    ask.addEventListener("click", () => {
      const field = root.querySelector("[data-copilot-search-input]");
      const question = field instanceof HTMLInputElement ? field.value.trim() : "";
      if (!question) {
        ui.notifications?.warn("Enter a campaign question first.");
        return;
      }
      const request = { action: "searchCampaign", args: { question } };
      CampaignCopilotPanel.#lastRequest = request;
      void CampaignCopilotPanel.#execute(root, request);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        ask.click();
      }
    });
  }

  /**
   * Open Copilot focused on explaining an entity.
   * @param {HTMLElement} container
   * @param {string} type
   * @param {string} id
   */
  static paintExplain(container, type, id) {
    CampaignCopilotPanel.paint(container, { focus: { type, id } });
  }

  /**
   * @param {string} action
   * @param {{ focus?: { type: string, id: string }|null }} options
   * @returns {{ action: string, args?: object }|null}
   */
  static #requestFor(action, options) {
    switch (action) {
      case "explainEntity": {
        const focus = options.focus || CampaignCopilotPanel.#resolveFocus();
        if (!focus) {
          ui.notifications?.warn(
            "Select an entity in Campaign (or control a token) before Explain Entity."
          );
          return null;
        }
        return { action, args: focus };
      }
      case "whatChanged":
        return { action: "sessionRecap" };
      case "sessionRecap":
      case "campaignSummary":
      case "forgottenThreads":
        return { action };
      default:
        return null;
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

  /**
   * @param {HTMLElement} root
   * @param {{ focus?: { type: string, id: string }|null }} options
   */
  static async #regenerate(root, options) {
    const request =
      CampaignCopilotPanel.#lastRequest ||
      CampaignCopilotPanel.#requestFor("explainEntity", options);
    if (!request) return;
    await CampaignCopilotPanel.#execute(root, request);
  }

  /**
   * @param {HTMLElement} root
   * @param {{ action: string, args?: object }} request
   */
  static async #execute(root, request) {
    const viewer = root.querySelector("[data-copilot-viewer]");
    if (!(viewer instanceof HTMLElement)) return;
    AIResponseViewer.setLoading(viewer);

    /** @type {import("./campaign-copilot.js").CopilotResult} */
    let result;
    try {
      switch (request.action) {
        case "explainEntity":
          result = await CampaignCopilot.explainEntity(
            request.args.type,
            request.args.id
          );
          break;
        case "campaignSummary":
          result = await CampaignCopilot.campaignSummary();
          break;
        case "sessionRecap":
          result = await CampaignCopilot.sessionRecap();
          break;
        case "searchCampaign":
          result = await CampaignCopilot.searchCampaign(request.args.question);
          break;
        case "forgottenThreads":
          result = CampaignCopilot.forgottenThreads(5);
          break;
        default:
          throw new Error(`Unknown Copilot action: ${request.action}`);
      }
    } catch (error) {
      AIResponseViewer.setError(viewer, error?.message || String(error));
      return;
    }

    if (!result.ok) {
      AIResponseViewer.setError(viewer, result.error || "Request failed.");
      return;
    }

    AIResponseViewer.setResult(viewer, {
      text: result.text,
      title: result.title,
      meta: result.meta
    });
  }
}
