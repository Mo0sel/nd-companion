import { CampaignMemoryService } from "./campaign-memory-service.js";
import { CompanionStorage } from "./storage.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";

const MAX_EVENTS = 500;
const DEDUPE_MS = 120_000;

/**
 * @typedef {object} CampaignActivityEvent
 * @property {string} id
 * @property {number} timestamp
 * @property {"created"|"edited"|"deleted"} action
 * @property {string} entityKind
 * @property {string} entityId
 * @property {string} entityName
 * @property {string|null} fieldName
 */

/**
 * Records deterministic edits to campaign knowledge (not Chronicle gameplay).
 */
export class CampaignActivityService {
  /**
   * @param {{
   *   action: "created"|"edited"|"deleted",
   *   entityKind: string,
   *   entityId: string,
   *   entityName?: string,
   *   fieldName?: string|null
   * }} input
   */
  static record(input) {
    if (!input?.entityKind || !input?.entityId || !input?.action) return;
    const name = input.entityName?.trim()
      || CampaignActivityService.#resolveName(input.entityKind, input.entityId)
      || "Untitled";
    const fieldName = input.fieldName?.trim() || null;
    const events = CompanionStorage.getActivityEvents();
    const last = events[0];
    const now = Date.now();
    if (
      input.action === "edited" &&
      last &&
      last.action === "edited" &&
      last.entityKind === input.entityKind &&
      last.entityId === input.entityId &&
      now - last.timestamp < DEDUPE_MS
    ) {
      last.timestamp = now;
      if (fieldName && last.fieldName !== fieldName) {
        last.fieldName = last.fieldName && last.fieldName !== fieldName
          ? `${last.fieldName}, ${fieldName}`
          : fieldName;
      }
      void CompanionStorage.setActivityEvents(events).then(() => {
        CampaignActivityService.refreshUI();
      });
      return;
    }
    events.unshift({
      id: foundry.utils.randomID(),
      timestamp: now,
      action: input.action,
      entityKind: input.entityKind,
      entityId: input.entityId,
      entityName: name,
      fieldName
    });
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
    void CompanionStorage.setActivityEvents(events).then(() => {
      CampaignActivityService.refreshUI();
    });
  }

  static created(entityKind, entityId, entityName) {
    CampaignActivityService.record({
      action: "created",
      entityKind,
      entityId,
      entityName
    });
  }

  static edited(entityKind, entityId, entityName, fieldName) {
    CampaignActivityService.record({
      action: "edited",
      entityKind,
      entityId,
      entityName,
      fieldName
    });
  }

  static deleted(entityKind, entityId, entityName) {
    CampaignActivityService.record({
      action: "deleted",
      entityKind,
      entityId,
      entityName
    });
  }

  /**
   * @param {{ filter?: "all"|"created"|"edited"|"deleted", limit?: number }} [options]
   * @returns {CampaignActivityEvent[]}
   */
  static list(options = {}) {
    const filter = options.filter ?? "all";
    const limit = Number.isFinite(options.limit) ? options.limit : MAX_EVENTS;
    let events = CompanionStorage.getActivityEvents();
    if (filter !== "all") {
      events = events.filter((event) => event.action === filter);
    }
    return events.slice(0, Math.max(0, limit));
  }

  /**
   * @param {string} query
   * @returns {CampaignActivityEvent[]}
   */
  static search(query) {
    const needle = String(query ?? "").trim().toLowerCase();
    if (!needle) return [];
    return CampaignActivityService.list({ limit: 20 }).filter((event) =>
      event.entityName.toLowerCase().includes(needle) ||
      CampaignActivityService.entityTypeLabel(event.entityKind).toLowerCase().includes(needle) ||
      (event.fieldName ?? "").toLowerCase().includes(needle)
    );
  }

  /**
   * Active live session start — edits after this count as "recently updated".
   * @returns {number}
   */
  static sessionPrepEpoch() {
    return SessionService.getActive()?.created ?? 0;
  }

  /**
   * @param {string} entityKind
   * @param {string} entityId
   */
  static isRecentlyUpdated(entityKind, entityId) {
    if (!entityKind || !entityId) return false;
    const epoch = CampaignActivityService.sessionPrepEpoch();
    if (!epoch) return false;
    return CompanionStorage.getActivityEvents().some(
      (event) =>
        event.entityKind === entityKind &&
        event.entityId === entityId &&
        event.action !== "deleted" &&
        event.timestamp >= epoch
    );
  }

  /**
   * Latest activity for an entity (for search subtitles).
   * @param {string} entityKind
   * @param {string} entityId
   * @returns {CampaignActivityEvent|null}
   */
  static latestFor(entityKind, entityId) {
    return CompanionStorage.getActivityEvents().find(
      (event) => event.entityKind === entityKind && event.entityId === entityId
    ) ?? null;
  }

  /** @param {number} timestamp */
  static formatRelative(timestamp) {
    const delta = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  /** @param {"created"|"edited"|"deleted"} action */
  static actionLabel(action) {
    switch (action) {
      case "created":
        return "Created";
      case "deleted":
        return "Deleted";
      default:
        return "Updated";
    }
  }

  /** @param {string} kind */
  static entityTypeLabel(kind) {
    switch (kind) {
      case "storyThread":
        return "Story Thread";
      case "questEntry":
        return "Quest";
      case "faction":
        return "Faction";
      case "session":
        return "Chronicle";
      case "actor":
        return "Actor";
      case "location":
        return "Location";
      case "item":
        return "Item";
      default:
        return "Entity";
    }
  }

  /**
   * @param {Record<string, unknown>} patch
   * @param {Record<string, string>} labels
   * @returns {string|null}
   */
  static patchFieldLabel(patch, labels) {
    if (!patch || !labels) return null;
    const fields = [];
    for (const [key, label] of Object.entries(labels)) {
      if (patch[key] !== undefined) fields.push(label);
    }
    return fields.length ? fields.join(", ") : null;
  }

  /**
   * @param {string} entityKind
   * @param {string} entityId
   * @returns {HTMLElement|null}
   */
  static recentBadge(entityKind, entityId) {
    if (!CampaignActivityService.isRecentlyUpdated(entityKind, entityId)) return null;
    const badge = document.createElement("span");
    badge.className = "nd-recent-badge";
    badge.textContent = "Recently Updated";
    return badge;
  }

  static refreshUI() {
    void import("./campaign-activity-panel.js").then(({ CampaignActivityPanel }) => {
      CampaignActivityPanel.refreshAll();
    });
  }

  /**
   * Parse CompanionStorage memory keys into activity records.
   * @param {string} key
   * @param {string} value
   */
  static recordMemoryWrite(key, value) {
    if (!key || typeof value !== "string") return;
    if (key.startsWith("status:")) {
      const [, storageKind, id] = key.split(":");
      const kind = storageKind === "scene" ? "location" : storageKind;
      if (!id || !["actor", "location", "item", "quest"].includes(kind)) return;
      CampaignActivityService.edited(
        kind === "quest" ? "questEntry" : kind,
        id,
        CampaignActivityService.#resolveName(kind, id),
        "Current Status"
      );
      return;
    }
    const colon = key.indexOf(":");
    if (colon < 0) return;
    const storageKind = key.slice(0, colon);
    const id = key.slice(colon + 1);
    const kind = storageKind === "scene" ? "location" : storageKind;
    if (!id || !["actor", "location", "item"].includes(kind)) return;
    if (!value.trim()) return;
    CampaignActivityService.edited(
      kind,
      id,
      CampaignActivityService.#resolveName(kind, id),
      "DM Notes"
    );
  }

  static #resolveName(kind, id) {
    switch (kind) {
      case "storyThread":
        return StoryThreadService.getById(id)?.title ?? "";
      case "questEntry":
      case "beat":
        return QuestEntryService.getById(id)?.title ?? "";
      case "faction":
        return FactionService.getById(id)?.name ?? "";
      case "session": {
        const session = CampaignMemoryService.getById(id)
          ?? SessionService.list().find((entry) => entry.id === id);
        return session ? CampaignMemoryService.label(session) : "";
      }
      case "actor":
      case "location":
      case "item":
      case "scene": {
        const registryKind = kind === "location" ? "scene" : kind;
        return EntityRegistry.findByUUID(id)?.name ?? "";
      }
      default:
        return "";
    }
  }
}
