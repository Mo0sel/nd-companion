/**
 * Session Wrap-Up Wizard — review AI proposals before CampaignUpdater writes.
 */

import { CampaignUpdater } from "./campaign-updater.js";
import { PlaybookService } from "./playbook-service.js";
import { SessionService } from "./session-service.js";
import { SessionWrapUp } from "./session-wrap-up.js";

const SECTIONS = [
  { key: "sessionSummary", label: "Session Summary", kind: "text" },
  { key: "timelineEvents", label: "Timeline Events", kind: "list" },
  { key: "questUpdates", label: "Quest Updates", kind: "objects" },
  { key: "npcChanges", label: "NPC Changes", kind: "objects" },
  { key: "newNPCs", label: "New NPCs", kind: "objects" },
  { key: "locationUpdates", label: "Location Updates", kind: "objects" },
  { key: "storyThreads", label: "Story Threads", kind: "objects" },
  { key: "playerDecisions", label: "Player Decisions", kind: "list" },
  { key: "futureHooks", label: "Future Hooks", kind: "list" },
  { key: "recommendedPrep", label: "DM Prep", kind: "list" }
];

export class SessionWrapUpPanel {
  /** @type {object|null} */
  static #proposal = null;

  /** @type {Record<string, boolean>} */
  static #approvals = {};

  /**
   * @param {HTMLElement} container
   * @param {{ onComplete?: () => void|Promise<void>, onCancel?: () => void }} [options]
   */
  static paint(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const root = document.createElement("div");
    root.className = "nd-wrapup";
    root.innerHTML = `
      <header class="nd-wrapup__header">
        <div>
          <div class="nd-wrapup__eyebrow">Session Wrap-Up</div>
          <h2>Review Campaign Updates</h2>
          <p>The AI proposes changes. You approve what gets written.</p>
        </div>
        <button type="button" data-wrapup-cancel>Cancel</button>
      </header>
      <div class="nd-wrapup__status" data-wrapup-status>Preparing wrap-up…</div>
      <div class="nd-wrapup__sections" data-wrapup-sections hidden></div>
      <footer class="nd-wrapup__footer" data-wrapup-footer hidden>
        <button type="button" data-wrapup-regenerate>Regenerate</button>
        <button type="button" data-wrapup-archive-plain>End Without AI</button>
        <button type="button" class="nd-campaign-save" data-wrapup-apply>Apply Approved &amp; End Session</button>
      </footer>
    `;
    container.replaceChildren(root);

    root.querySelector("[data-wrapup-cancel]")?.addEventListener("click", () => {
      options.onCancel?.();
    });
    root.querySelector("[data-wrapup-regenerate]")?.addEventListener("click", () => {
      void SessionWrapUpPanel.#runGenerate(root, options);
    });
    root.querySelector("[data-wrapup-archive-plain]")?.addEventListener("click", () => {
      void SessionWrapUpPanel.#archivePlain(root, options);
    });
    root.querySelector("[data-wrapup-apply]")?.addEventListener("click", () => {
      void SessionWrapUpPanel.#apply(root, options);
    });

    void SessionWrapUpPanel.#runGenerate(root, options);
  }

  /**
   * @param {HTMLElement} root
   * @param {object} options
   */
  static async #runGenerate(root, options) {
    const status = root.querySelector("[data-wrapup-status]");
    const sections = root.querySelector("[data-wrapup-sections]");
    const footer = root.querySelector("[data-wrapup-footer]");
    if (status instanceof HTMLElement) {
      status.hidden = false;
      status.textContent = "Collecting session data and asking the AI…";
      status.classList.remove("is-error");
    }
    if (sections instanceof HTMLElement) sections.hidden = true;
    if (footer instanceof HTMLElement) footer.hidden = true;

    const result = await SessionWrapUp.generateProposal();
    if (!result.ok || !result.proposal) {
      if (status instanceof HTMLElement) {
        status.textContent = result.error || "Wrap-up failed.";
        status.classList.add("is-error");
      }
      if (footer instanceof HTMLElement) {
        footer.hidden = false;
        const apply = footer.querySelector("[data-wrapup-apply]");
        if (apply instanceof HTMLElement) apply.hidden = true;
      }
      return;
    }

    SessionWrapUpPanel.#proposal = foundry.utils.duplicate(result.proposal);
    SessionWrapUpPanel.#approvals = Object.fromEntries(
      SECTIONS.map((section) => [section.key, true])
    );

    if (status instanceof HTMLElement) {
      status.textContent = "Review each section. Uncheck anything you do not want applied.";
      status.classList.remove("is-error");
    }
    SessionWrapUpPanel.#paintSections(root);
    if (sections instanceof HTMLElement) sections.hidden = false;
    if (footer instanceof HTMLElement) {
      footer.hidden = false;
      const apply = footer.querySelector("[data-wrapup-apply]");
      if (apply instanceof HTMLElement) apply.hidden = false;
    }
    void options;
  }

  /**
   * @param {HTMLElement} root
   */
  static #paintSections(root) {
    const host = root.querySelector("[data-wrapup-sections]");
    if (!(host instanceof HTMLElement) || !SessionWrapUpPanel.#proposal) return;
    host.replaceChildren();

    for (const section of SECTIONS) {
      const value = SessionWrapUpPanel.#proposal[section.key];
      const details = document.createElement("details");
      details.className = "nd-wrapup__section";
      details.open = true;

      const summary = document.createElement("summary");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = SessionWrapUpPanel.#approvals[section.key] !== false;
      check.addEventListener("change", () => {
        SessionWrapUpPanel.#approvals[section.key] = check.checked;
      });
      const label = document.createElement("span");
      label.textContent = section.label;
      summary.append(check, label);
      details.append(summary);

      const editor = document.createElement("textarea");
      editor.className = "nd-wrapup__editor";
      editor.value = SessionWrapUpPanel.#toEditable(section.kind, value);
      editor.addEventListener("change", () => {
        SessionWrapUpPanel.#proposal[section.key] = SessionWrapUpPanel.#fromEditable(
          section.kind,
          editor.value,
          value
        );
      });
      details.append(editor);
      host.append(details);
    }
  }

  /**
   * @param {string} kind
   * @param {unknown} value
   */
  static #toEditable(kind, value) {
    if (kind === "text") return String(value ?? "");
    if (kind === "list") {
      return Array.isArray(value) ? value.map(String).join("\n") : "";
    }
    return JSON.stringify(value ?? [], null, 2);
  }

  /**
   * @param {string} kind
   * @param {string} text
   * @param {unknown} fallback
   */
  static #fromEditable(kind, text, fallback) {
    if (kind === "text") return text.trim();
    if (kind === "list") {
      return text
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }
    try {
      const parsed = JSON.parse(text || "[]");
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  /**
   * Classic archive when AI wrap-up is unavailable or declined.
   * @param {HTMLElement} root
   * @param {{ onComplete?: () => void|Promise<void> }} options
   */
  static async #archivePlain(root, options) {
    const active = SessionService.getActive();
    if (!active) {
      ui.notifications?.warn("There is no active session to end.");
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "End Session" },
      content:
        `<p>Archive <strong>Session ${active.sessionNumber}</strong> without AI wrap-up ` +
        `and start <strong>Session ${active.sessionNumber + 1}</strong>?</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;

    const status = root.querySelector("[data-wrapup-status]");
    if (status instanceof HTMLElement) {
      status.textContent = "Archiving session…";
      status.classList.remove("is-error");
    }

    try {
      const result = await SessionService.endActiveSession();
      if (!result) throw new Error("The session could not be archived.");
      await PlaybookService.reset();
      ui.notifications?.info(
        `Session ${result.archived.sessionNumber} archived. Session ${result.next.sessionNumber} is ready.`
      );
      await options.onComplete?.();
    } catch (error) {
      console.error("N&D Companion: plain session end failed", error);
      if (status instanceof HTMLElement) {
        status.textContent = error?.message || "Failed to archive session.";
        status.classList.add("is-error");
      }
      ui.notifications?.error("Session could not be archived.");
    }
  }

  /**
   * @param {HTMLElement} root
   * @param {{ onComplete?: () => void|Promise<void> }} options
   */
  static async #apply(root, options) {
    if (!SessionWrapUpPanel.#proposal) return;
    const status = root.querySelector("[data-wrapup-status]");
    if (status instanceof HTMLElement) {
      status.textContent = "Applying approved updates…";
      status.classList.remove("is-error");
    }

    try {
      const result = await CampaignUpdater.applyWrapUp({
        proposal: SessionWrapUpPanel.#proposal,
        approvals: SessionWrapUpPanel.#approvals,
        edited: SessionWrapUpPanel.#proposal
      });
      await PlaybookService.reset();
      ui.notifications?.info(
        `Session ${result.archived.sessionNumber} wrapped up. ` +
          `Session ${result.next.sessionNumber} is ready.`
      );
      await options.onComplete?.();
    } catch (error) {
      console.error("N&D Companion: wrap-up apply failed", error);
      if (status instanceof HTMLElement) {
        status.textContent = error?.message || "Failed to apply wrap-up.";
        status.classList.add("is-error");
      }
      ui.notifications?.error("Session wrap-up failed. See the console.");
    }
  }
}
