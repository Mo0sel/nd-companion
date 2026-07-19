import { CampaignAwareness, CampaignContext } from "./campaign-context.js";
import { CampaignWorkspace } from "./campaign-workspace.js";
import { EntityRegistry } from "./entity-registry.js";
import { FocusManager } from "./focus-manager.js";
import { FocusPanel } from "./focus-panel.js";
import { GlobalSearch } from "./global-search.js";
import { LiveNotes } from "./live-notes.js";
import { Navigation } from "./navigation.js";
import { PanelResizer } from "./panel-resizer.js";
import { Playbook } from "./playbook.js";
import { PlaybookPrepare } from "./playbook-prepare.js";
import { PlaybookService } from "./playbook-service.js";
import { RichText } from "./rich-text.js";
import { SessionBuilder } from "./session-builder.js";
import { SessionService } from "./session-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const WORKSPACES = new Set(["play", "prepare", "campaign", "notes"]);

/**
 * The N&D Companion window.
 */
export class CompanionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {"play"|"prepare"|"campaign"|"notes"} */
  workspace = "play";

  static DEFAULT_OPTIONS = {
    id: "nd-companion-app",
    tag: "div",
    classes: ["nd-companion"],
    window: {
      title: "N&D Companion",
      icon: "fa-solid fa-robot",
      resizable: true
    },
    position: {
      width: 960,
      height: 720
    },
    actions: {
      setWorkspace: CompanionApp.#onSetWorkspace
    }
  };

  static PARTS = {
    content: {
      template: "modules/nd-companion/templates/companion.hbs"
    }
  };

  /**
   * Switch the lower workspace region. Safe to call from actions or future hotkeys.
   * @param {"play"|"prepare"|"campaign"|"notes"} workspace
   */
  setWorkspace(workspace) {
    if (!WORKSPACES.has(workspace)) return;
    this.workspace = workspace;
    this.#applyWorkspace();
    if (workspace === "campaign") CampaignWorkspace.paint(this.element);
  }

  /**
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onSetWorkspace(_event, target) {
    this.setWorkspace(target.dataset.workspace);
  }

  #applyWorkspace() {
    const root = this.element;
    if (!root) return;

    root.querySelectorAll("[data-workspace-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.workspacePanel !== this.workspace;
    });

    root.querySelectorAll("[data-action=\"setWorkspace\"]").forEach((button) => {
      const active = button.dataset.workspace === this.workspace;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
  }

  /**
   * @param {ApplicationRenderContext} _context
   * @param {ApplicationRenderOptions} _options
   */
  #paintSessionBadge() {
    const badge = this.element?.querySelector("[data-session-badge]");
    const label = this.element?.querySelector("[data-session-badge-label]");
    if (!(badge instanceof HTMLElement) || !(label instanceof HTMLElement)) return;

    const session = SessionService.getActive();
    if (!session) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    const isActive = session.status === "active";
    badge.toggleAttribute("data-idle", !isActive);
    const sessionLabel = session.title?.trim()
      ? `Session ${session.sessionNumber} · ${session.title.trim()}`
      : `Session ${session.sessionNumber}`;
    label.textContent = `${sessionLabel}${isActive ? " · Live" : ""}`;
  }

  async _onRender(_context, _options) {
    await super._onRender(_context, _options);
    this.#applyWorkspace();
    this.#paintSessionBadge();
    CampaignAwareness.paint(this.element, CampaignContext.get());
    FocusPanel.paint(this.element, FocusManager.get());
    Playbook.paint(this.element, Playbook.get());
    Playbook.attach(this.element, {
      onEndSession: async () => {
        const active = SessionService.getActive();
        if (!active) {
          ui.notifications?.warn("There is no active session to end.");
          return;
        }

        const log = this.element.querySelector("[data-storage=\"sessionLog\"]");
        if (log instanceof HTMLElement) {
          await SessionService.setActiveSessionLog(log.textContent ?? "");
        }

        const nextNumber = active.sessionNumber + 1;
        if (SessionService.list().some(
          (session) => session.id !== active.id && session.sessionNumber === nextNumber
        )) {
          ui.notifications?.warn(
            `Session ${nextNumber} already exists. Resolve that Chronicle entry before ending this session.`
          );
          return;
        }
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: "End Session" },
          content:
            `<p>Archive <strong>Session ${active.sessionNumber}</strong> in Chronicle ` +
            `and start <strong>Session ${nextNumber}</strong>?</p>`,
          rejectClose: false,
          modal: true
        });
        if (confirmed !== true) return;

        const result = await SessionService.endActiveSession();
        if (!result) {
          ui.notifications?.error("The session could not be archived.");
          return;
        }

        await PlaybookService.reset();
        ui.notifications?.info(
          `Session ${result.archived.sessionNumber} archived. Session ${result.next.sessionNumber} is ready.`
        );
        await this.render({ force: true });
      }
    });
    PlaybookPrepare.paint(this.element);
    PlaybookPrepare.attach(this.element);
    SessionBuilder.attach(this.element);
    CampaignWorkspace.paint(this.element);
    CampaignWorkspace.attach(this.element, {
      onOpenBeat: async (index) => {
        const moved = await PlaybookService.setCurrentIndex(index);
        if (!moved) return;
        this.setWorkspace("play");
        Playbook.paint(this.element, Playbook.get());
      }
    });
    this.element.querySelectorAll("[data-storage]:not([data-memory-editor])").forEach((el) => {
      const html = el.hasAttribute("data-storage-html");
      LiveNotes.attach(el, el.dataset.storage, {
        html,
        sanitize: html ? RichText.sanitize : undefined
      });
    });
    PanelResizer.attach(this.element);
    GlobalSearch.attach(this.element, {
      openSession: (id) => {
        if (SessionService.getActive()?.id === id) {
          this.setWorkspace("play");
          return;
        }
        if (!CampaignWorkspace.selectSession(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openBeat: async (id) => {
        const index = PlaybookService.getDocument().beats.findIndex((beat) => beat.id === id);
        if (index < 0) return;
        const moved = await PlaybookService.setCurrentIndex(index);
        if (!moved) return;
        this.setWorkspace("play");
        Playbook.paint(this.element, Playbook.get());
      },
      openThread: (id) => {
        if (!CampaignWorkspace.selectThread(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openQuestEntry: (id) => {
        if (!CampaignWorkspace.selectQuestEntry(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openMemory: (id) => {
        if (!CampaignWorkspace.selectMemory(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openEntity: async (uuid, kind) => {
        const entity = EntityRegistry.findByUUID(uuid);
        if (!entity) return false;
        if (kind === "actor") {
          const result = await Navigation.navigate(entity);
          this.setWorkspace("notes");
          return result.status !== "failed";
        }
        if (Navigation.canNavigate(entity)) {
          const result = await Navigation.navigate(entity);
          return result.status !== "failed";
        }
        ui.notifications?.info(`Direct opening for ${entity.name} is not available yet.`);
        return false;
      },
      notify: (message) => ui.notifications?.info(message)
    });
  }
}
