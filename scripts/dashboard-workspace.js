/**
 * Dashboard landing workspace — campaign operating overview.
 */

import { ContextEngine } from "./context-engine.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
import { RichText } from "./rich-text.js";

export class DashboardWorkspace {
  /**
   * @param {HTMLElement} root
   * @param {{
   *   onNavigate?: (workspace: string) => void,
   *   onEndSession?: () => void|Promise<void>,
   *   onAskCopilot?: () => void
   * }} [options]
   */
  static paint(root, options = {}) {
    const panel = root?.querySelector?.("[data-workspace-panel=\"dashboard\"]");
    if (!(panel instanceof HTMLElement)) return;

    const session = SessionService.getActive();
    const sessionCtx = ContextEngine.getSessionContext();
    const campaign = ContextEngine.getCampaignContext();
    const threads = StoryThreadService.list().filter((thread) => thread.status === "ACTIVE");
    const quests = QuestEntryService.list().filter(
      (entry) => entry.status === "ACTIVE" || entry.status === "PLANNED"
    );
    const notes = RichText.plainText(session?.notes ?? "").trim();
    const scene =
      sessionCtx.importantLocations?.[0]?.name ||
      "No focused scene";

    panel.replaceChildren();

    const header = document.createElement("header");
    header.className = "nd-dashboard__header";
    header.innerHTML = `
      <div>
        <div class="nd-dashboard__eyebrow">Campaign Operating System</div>
        <h2 class="nd-dashboard__title">${DashboardWorkspace.#escape(game.world?.title || "Campaign")}</h2>
      </div>
      <button type="button" class="nd-dashboard__end" data-dashboard-end-session>End Session</button>
    `;
    panel.append(header);

    const grid = document.createElement("div");
    grid.className = "nd-dashboard__grid";

    grid.append(
      DashboardWorkspace.#card(
        "Current Session",
        session
          ? `Session ${session.sessionNumber}${session.title ? ` · ${session.title}` : ""}\nStatus: ${session.status}`
          : "No active session",
        "play",
        "Open Play"
      ),
      DashboardWorkspace.#card("Current Scene", scene, "locations", "Browse Locations"),
      DashboardWorkspace.#card(
        "Active Quests",
        quests.length
          ? quests
              .slice(0, 5)
              .map((quest) => `• ${quest.title || "Untitled"} [${quest.status}]`)
              .join("\n")
          : "No open quests",
        "campaign",
        "Open Campaign"
      ),
      DashboardWorkspace.#card(
        "Recent Notes",
        notes ? notes.slice(0, 280) : "No session notes yet",
        "play",
        "Edit Notes"
      ),
      DashboardWorkspace.#card(
        "Story Threads",
        threads.length
          ? threads
              .slice(0, 5)
              .map((thread) => `• ${thread.title || "Untitled"}`)
              .join("\n")
          : "No active story threads",
        "campaign",
        "Open Campaign"
      ),
      DashboardWorkspace.#card(
        "Campaign Timeline",
        (campaign.recentChronicle ?? [])
          .slice(0, 4)
          .map((entry) => `• Session ${entry.sessionNumber}: ${entry.label || entry.title || ""}`)
          .join("\n") || "No chronicle entries yet",
        "sessions",
        "Open Sessions"
      ),
      DashboardWorkspace.#card(
        "Quick Ask Copilot",
        "Explain entities, recap the session, or search campaign knowledge.",
        "copilot",
        "Open Copilot"
      )
    );

    panel.append(grid);

    panel.querySelector("[data-dashboard-end-session]")?.addEventListener("click", () => {
      void options.onEndSession?.();
    });

    panel.querySelectorAll("[data-dashboard-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const workspace = button.getAttribute("data-dashboard-nav");
        if (workspace) options.onNavigate?.(workspace);
      });
    });
  }

  /**
   * @param {string} title
   * @param {string} body
   * @param {string} workspace
   * @param {string} actionLabel
   */
  static #card(title, body, workspace, actionLabel) {
    const card = document.createElement("article");
    card.className = "nd-dashboard__card";
    const h = document.createElement("h3");
    h.textContent = title;
    const p = document.createElement("pre");
    p.className = "nd-dashboard__card-body";
    p.textContent = body;
    const action = document.createElement("button");
    action.type = "button";
    action.dataset.dashboardNav = workspace;
    action.textContent = actionLabel;
    card.append(h, p, action);
    return card;
  }

  static #escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
