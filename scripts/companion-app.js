import { CampaignAwareness, CampaignContext } from "./campaign-context.js";
import { CampaignActivityPanel } from "./campaign-activity-panel.js";
import { CampaignDocument } from "./campaign-document.js";
import { CampaignWorkspace } from "./campaign-workspace.js";
import { ContextEngine } from "./context-engine.js";
import { ContextPanel } from "./context-panel.js";
import { EntityRegistry } from "./entity-registry.js";
import { FocusManager } from "./focus-manager.js";
import { FocusPanel } from "./focus-panel.js";
import { GlobalSearch } from "./global-search.js";
import { LiveNotes } from "./live-notes.js";
import { Navigation } from "./navigation.js";
import { NavigationHistory } from "./navigation-history.js";
import { PanelResizer } from "./panel-resizer.js";
import { Playbook } from "./playbook.js";
import { PlaybookService } from "./playbook-service.js";
import { QuickEdit } from "./quick-edit.js";
import { RelationshipExplorer } from "./relationship-explorer.js";
import { RichText } from "./rich-text.js";
import { SessionService } from "./session-service.js";
import { CompanionStorage } from "./storage.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const WORKSPACES = new Set(["play", "campaign", "notes"]);

/**
 * The N&D Companion window.
 */
export class CompanionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {"play"|"campaign"|"notes"} */
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
      setWorkspace: CompanionApp.#onSetWorkspace,
      exportCampaign: CompanionApp.#onExportCampaign,
      importCampaign: CompanionApp.#onImportCampaign,
      openActivityDrawer: CompanionApp.#onOpenActivityDrawer,
      closeActivityDrawer: CompanionApp.#onCloseActivityDrawer
    }
  };

  static PARTS = {
    content: {
      template: "modules/nd-companion/templates/companion.hbs"
    }
  };

  /**
   * Switch the lower workspace region. Safe to call from actions or future hotkeys.
   * @param {"play"|"campaign"|"notes"} workspace
   */
  setWorkspace(workspace) {
    if (!WORKSPACES.has(workspace)) return;
    if (this.element instanceof HTMLElement) {
      if (this.workspace === "campaign") {
        void CampaignWorkspace.flush(this.element).catch(() => {});
      }
      void LiveNotes.flushAll(this.element).catch(() => {});
    }
    this.workspace = workspace;
    this.#applyWorkspace();
    if (workspace === "campaign") CampaignWorkspace.paint(this.element);
    if (workspace === "play") Playbook.paint(this.element, Playbook.get());
  }

  /**
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onSetWorkspace(_event, target) {
    this.setWorkspace(target.dataset.workspace);
  }

  /**
   * Open Campaign Activity from Settings (kept out of main Campaign nav).
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static #onOpenActivityDrawer(_event, _target) {
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;
    const settings = root.querySelector(".nd-companion-settings");
    if (settings instanceof HTMLDetailsElement) settings.open = false;
    CompanionApp.#paintActivityDrawer(root, true);
  }

  /**
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   */
  static #onCloseActivityDrawer(_event, _target) {
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;
    CompanionApp.#paintActivityDrawer(root, false);
  }

  /**
   * @param {HTMLElement} root
   * @param {boolean} [open]
   */
  static #paintActivityDrawer(root, open) {
    const drawer = root.querySelector("[data-activity-drawer]");
    if (!(drawer instanceof HTMLElement)) return;
    if (open === false) {
      drawer.hidden = true;
      return;
    }
    if (open === true) drawer.hidden = false;
    if (drawer.hidden) return;
    const container = drawer.querySelector("[data-campaign-activity]");
    if (!(container instanceof HTMLElement)) return;
    const filter = container.dataset.activityFilter ?? "all";
    CampaignActivityPanel.paint(container, {
      filter: ["all", "created", "edited", "deleted"].includes(filter) ? filter : "all",
      limit: Number(container.dataset.activityLimit) || 500,
      showFilters: true
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {(target: { kind: string, id: string }) => Promise<void>|void} onOpen
   */
  static #attachActivityDrawer(root, onOpen) {
    const drawer = root.querySelector("[data-activity-drawer]");
    if (!(drawer instanceof HTMLElement)) return;
    if (drawer.dataset.activityBound === "1") return;
    drawer.dataset.activityBound = "1";
    drawer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const filter = target.closest("[data-activity-filter]");
      if (filter instanceof HTMLButtonElement) {
        const next = filter.getAttribute("data-activity-filter");
        const container = drawer.querySelector("[data-campaign-activity]");
        if (
          container instanceof HTMLElement &&
          (next === "all" || next === "created" || next === "edited" || next === "deleted")
        ) {
          container.dataset.activityFilter = next;
          CompanionApp.#paintActivityDrawer(root);
        }
        return;
      }

      const openRow = target.closest("[data-activity-open]");
      if (openRow) {
        const kind = openRow.getAttribute("data-activity-entity-kind");
        const id = openRow.getAttribute("data-activity-entity-id");
        if (kind && id) {
          CompanionApp.#paintActivityDrawer(root, false);
          void onOpen({ kind, id });
        }
      }
    });
  }

  /**
   * Export the read-only serialization payload as formatted JSON.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onExportCampaign(_event, target) {
    try {
      const payload = CompanionStorage.serializeCampaign();
      const json = JSON.stringify(payload, null, 2);
      const campaignName = game.world?.title?.trim() || "Campaign";
      const date = new Date().toISOString().slice(0, 10);
      const filename = `${CompanionApp.#safeFilenamePart(campaignName)}_${date}.ndcompanion.json`;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      // Foundry's chrome installs document-level anchor handlers and a base
      // target that reroute bubbled clicks into a new tab. Force same-frame
      // navigation and dispatch a non-bubbling click so only the anchor's
      // default download action runs.
      anchor.target = "_self";
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true }));
      anchor.remove();
      // Revoke after the download has been handed to the browser; revoking in
      // the same task can abort the transfer for large payloads.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const sessions = Array.isArray(payload.campaign?.sessions)
        ? payload.campaign.sessions.length
        : 0;
      // CampaignThread is the persisted model presented to the user as a Quest.
      const quests = Array.isArray(payload.campaign?.threads)
        ? payload.campaign.threads.length
        : 0;
      ui.notifications?.info(
        `Campaign exported successfully. Sessions: ${sessions} · ` +
        `Quests (Threads): ${quests}`
      );
      target.closest("details")?.removeAttribute("open");
    } catch (error) {
      console.error("N&D Companion: campaign export failed", error);
      ui.notifications?.error("Campaign export failed. See the console for details.");
    }
  }

  /**
   * Select, validate, preview, and import one serialized campaign file.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onImportCampaign(_event, target) {
    const app = this;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ndcompanion.json,.json,application/json";
    input.hidden = true;
    document.body.append(input);
    input.addEventListener("cancel", () => input.remove(), { once: true });

    input.addEventListener("change", async () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      if (!file) return;

      try {
        const text = await file.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (_error) {
          ui.notifications?.error("Selected file is not valid JSON.");
          return;
        }

        const validation = CompanionStorage.validateCampaignPayload(parsed);
        if (!validation.valid) {
          ui.notifications?.error(
            `Campaign import validation failed: ${validation.errors.join(" • ")}`
          );
          return;
        }

        const payload = CompanionStorage.deserializeCampaign(parsed);
        const confirmed = await CompanionApp.#confirmCampaignImport(payload);
        if (confirmed !== true) return;

        await CompanionStorage.applyCampaignPayload(payload);
        await CampaignDocument.ready();
        PlaybookService.reload();
        await PlaybookService.alignStoryEntrySources();
        await SessionService.ready();
        target.closest("details")?.removeAttribute("open");
        await app.render({ force: true });
        ui.notifications?.info("Campaign imported successfully.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("N&D Companion: campaign import failed", error);
        ui.notifications?.error(message);
      }
    }, { once: true });

    input.click();
  }

  /**
   * Show a read-only import preview and require explicit confirmation.
   * @param {import("./storage.js").CampaignPayload} payload
   * @returns {Promise<boolean>}
   */
  static async #confirmCampaignImport(payload) {
    const campaign = payload.campaign ?? {};
    const campaignName = [
      campaign.name,
      campaign.title,
      campaign.campaignName
    ].find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
    const sessions = Array.isArray(campaign.sessions) ? campaign.sessions.length : 0;
    const storyEntries = Array.isArray(campaign.storyEntries)
      ? campaign.storyEntries.length
      : Array.isArray(campaign.questEntries) ? campaign.questEntries.length : 0;
    const storyThreads = Array.isArray(campaign.storyThreads)
      ? campaign.storyThreads.length
      : 0;
    const factions = Array.isArray(campaign.factions) ? campaign.factions.length : 0;
    const row = (label, value) =>
      `<div><dt>${foundry.utils.escapeHTML(label)}</dt>` +
      `<dd>${foundry.utils.escapeHTML(String(value))}</dd></div>`;
    const rows = [
      campaignName ? row("Campaign", campaignName) : "",
      row("Module Version", payload.moduleVersion),
      row("Schema Version", payload.schemaVersion),
      row("Export Date", payload.exportedAt || "Not provided"),
      row("Sessions", sessions),
      row("Story Threads", storyThreads),
      row("Quests", storyEntries),
      row("Factions", factions)
    ].join("");

    return foundry.applications.api.DialogV2.confirm({
      window: { title: "Import Campaign" },
      content:
        `<p>This will replace the Companion data in the current world.</p>` +
        `<dl class="nd-import-preview">${rows}</dl>`,
      rejectClose: false,
      modal: true
    });
  }

  /**
   * Produce a filename component valid on Windows and macOS.
   * @param {string} value
   * @returns {string}
   */
  static #safeFilenamePart(value) {
    const safe = String(value ?? "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 120);
    if (!safe || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) {
      return "Campaign";
    }
    return safe;
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
   * Navigate directly between Context Panel entities without using Search.
   * @param {{ kind: string, id: string, label?: string }} target
   * @param {{ trackHistory?: boolean }} [options]
   */
  async #openContextTarget(target, options = {}) {
    if (!target?.kind || !target?.id) return;
    const trackHistory = options.trackHistory !== false;
    const from = trackHistory ? CampaignWorkspace.getFocusTarget() : null;
    const destination = CompanionApp.#labelTarget(target);

    if (trackHistory) {
      NavigationHistory.navigate(from, destination);
    }

    if (target.kind === "session") {
      if (CampaignWorkspace.selectMemory(this.element, target.id)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "quest") {
      if (CampaignWorkspace.selectQuest(this.element, target.id)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "storyThread") {
      if (CampaignWorkspace.selectStoryThread(this.element, target.id)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "faction") {
      if (CampaignWorkspace.selectFaction(this.element, target.id)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "questEntry") {
      if (CampaignWorkspace.selectQuestEntry(this.element, target.id)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "beat") {
      if (CampaignWorkspace.selectQuestEntry(this.element, target.id)) {
        this.setWorkspace("campaign");
      } else {
        const index = PlaybookService.getDocument().beats.findIndex(
          (beat) => beat.id === target.id
        );
        if (index >= 0 && await PlaybookService.setCurrentIndex(index)) {
          this.setWorkspace("play");
          Playbook.paint(this.element, Playbook.get());
        }
      }
    } else if (target.kind === "actor") {
      const actor = EntityRegistry.findByUUID(target.id)
        ?? EntityRegistry.all("actor").find((entity) => entity.id === target.id);
      if (actor && CampaignWorkspace.selectEntity(this.element, "actor", actor.uuid)) {
        this.setWorkspace("campaign");
      }
    } else if (target.kind === "location" || target.kind === "item") {
      const kind = target.kind === "location" ? "scene" : "item";
      const entity = EntityRegistry.findByUUID(target.id)
        ?? EntityRegistry.all(kind).find((entry) => entry.id === target.id);
      if (entity && CampaignWorkspace.selectEntity(this.element, kind, entity.uuid)) {
        this.setWorkspace("campaign");
      }
    } else {
      const entity = EntityRegistry.findByUUID(target.id)
        ?? EntityRegistry.all(target.kind).find((entry) => entry.id === target.id);
      if (entity && Navigation.canNavigate(entity)) {
        await Navigation.navigate(entity);
      }
    }

    const landed = CampaignWorkspace.getFocusTarget();
    if (landed) NavigationHistory.syncCurrent(landed);
    RelationshipExplorer.paintChrome(this.element);
  }

  /**
   * @param {{ kind: string, id: string, label?: string }} target
   * @returns {{ kind: string, id: string, label: string }}
   */
  static #labelTarget(target) {
    const context = ContextEngine.getContext(target);
    return {
      kind: target.kind,
      id: target.id,
      label: context.target?.label?.trim()
        || target.label?.trim()
        || "Untitled"
    };
  }

  async #historyBack() {
    const entry = NavigationHistory.back();
    if (!entry) return;
    await this.#openContextTarget(entry, { trackHistory: false });
  }

  async #historyForward() {
    const entry = NavigationHistory.forward();
    if (!entry) return;
    await this.#openContextTarget(entry, { trackHistory: false });
  }

  async #historyJump(index) {
    const entry = NavigationHistory.jumpTo(index);
    if (!entry) return;
    await this.#openContextTarget(entry, { trackHistory: false });
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

  async close(options = {}) {
    if (this.element instanceof HTMLElement) {
      try {
        await Promise.all([
          CampaignWorkspace.flush(this.element),
          LiveNotes.flushAll(this.element)
        ]);
      } catch (error) {
        console.error("N&D Companion: close blocked by unsaved changes", error);
        ui.notifications.error("N&D Companion still has unsaved changes. Saving will retry automatically.");
        return this;
      }
    }
    return super.close(options);
  }

  async _onRender(_context, _options) {
    await super._onRender(_context, _options);
    this.#applyWorkspace();
    this.#paintSessionBadge();
    CampaignAwareness.paint(this.element, CampaignContext.get());
    FocusPanel.paint(this.element, FocusManager.get());
    Playbook.paint(this.element, Playbook.get());
    Playbook.attach(this.element, {
      onSelectSession: async (id) => {
        try {
          await LiveNotes.flushAll(this.element);
        } catch {
          return;
        }
        if (!await SessionService.setActive(id)) return;
        await this.render({ force: true });
      },
      onOpenStoryThread: (id) => {
        if (CampaignWorkspace.selectStoryThread(this.element, id)) {
          this.setWorkspace("campaign");
        }
      },
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
    CampaignWorkspace.paint(this.element);
    CampaignWorkspace.attach(this.element, {
      onOpenBeat: async (index) => {
        const moved = await PlaybookService.setCurrentIndex(index);
        if (!moved) return;
        this.setWorkspace("play");
        Playbook.paint(this.element, Playbook.get());
      }
    });
    CompanionApp.#attachActivityDrawer(this.element, (target) => this.#openContextTarget(target));
    ContextPanel.attach(this.element, (target) => this.#openContextTarget(target));
    RelationshipExplorer.attach(this.element, {
      onBack: () => this.#historyBack(),
      onForward: () => this.#historyForward(),
      onJump: (index) => this.#historyJump(index),
      onRefresh: () => {
        CampaignWorkspace.paint(this.element);
        CampaignActivityPanel.refreshAll?.();
      }
    });
    RelationshipExplorer.paintChrome(this.element);
    QuickEdit.attach(this.element, {
      onRefresh: () => {
        CampaignWorkspace.paint(this.element);
        Playbook.paint(this.element, Playbook.get());
        CampaignActivityPanel.refreshAll?.();
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
      openStoryThread: (id) => {
        if (!CampaignWorkspace.selectStoryThread(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openFaction: (id) => {
        if (!CampaignWorkspace.selectFaction(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openQuestEntry: (id) => {
        if (!CampaignWorkspace.selectQuestEntry(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openActivityEntity: ({ kind, id }) => {
        void this.#openContextTarget({ kind, id });
        return true;
      },
      openMemory: (id) => {
        if (!CampaignWorkspace.selectMemory(this.element, id)) return;
        this.setWorkspace("campaign");
      },
      openEntity: async (uuid, kind) => {
        const entity = EntityRegistry.findByUUID(uuid);
        if (!entity) return false;
        if (["actor", "scene", "item"].includes(kind)) {
          const contextKind = kind === "scene" ? "location" : kind;
          await this.#openContextTarget({ kind: contextKind, id: uuid });
          return true;
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
