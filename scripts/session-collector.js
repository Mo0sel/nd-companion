/**
 * SessionCollector — modular read-only gatherers for Session Wrap-Up.
 * Collectors never write campaign data.
 */

import { CampaignActivityService } from "./campaign-activity-service.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { ContextEngine } from "./context-engine.js";
import { EntityRegistry } from "./entity-registry.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
import { CompanionStorage } from "./storage.js";

/**
 * @typedef {object} SessionCollection
 * @property {object|null} session
 * @property {string} notes
 * @property {string} sessionLog
 * @property {object} context
 * @property {object[]} storyThreads
 * @property {object[]} quests
 * @property {object[]} recentActivity
 * @property {object[]} chronicle
 * @property {object[]} actors
 * @property {object[]} locations
 * @property {Record<string, unknown>} extras
 * @property {string[]} collectors
 */

/** @type {Map<string, () => object|Promise<object>>} */
const EXTRA_COLLECTORS = new Map();

export class SessionCollector {
  /**
   * Register a future collector (ChatCollector, CombatCollector, …).
   * @param {string} id
   * @param {() => object|Promise<object>} fn
   */
  static register(id, fn) {
    if (!id || typeof fn !== "function") {
      throw new Error("SessionCollector.register requires id and function");
    }
    EXTRA_COLLECTORS.set(id, fn);
  }

  /**
   * @param {string} id
   */
  static unregister(id) {
    EXTRA_COLLECTORS.delete(id);
  }

  /** @returns {string[]} */
  static listCollectors() {
    return [
      "sessionNotes",
      "sessionLog",
      "context",
      "storyThreads",
      "quests",
      "activity",
      "chronicle",
      "actors",
      "locations",
      ...EXTRA_COLLECTORS.keys()
    ];
  }

  /**
   * Gather everything PromptBuilder needs for wrap-up.
   * @returns {Promise<SessionCollection>}
   */
  static async collect() {
    const session = SessionService.getActive();
    const context = ContextEngine.getSessionContext();
    const campaign = ContextEngine.getCampaignContext();

    /** @type {Record<string, unknown>} */
    const extras = {};
    for (const [id, fn] of EXTRA_COLLECTORS) {
      try {
        extras[id] = await fn();
      } catch (error) {
        console.warn(`N&D Companion: collector "${id}" failed`, error);
        extras[id] = { error: error?.message || String(error) };
      }
    }

    return {
      session: session
        ? {
            id: session.id,
            sessionNumber: session.sessionNumber,
            title: session.title ?? "",
            status: session.status ?? "",
            notes: session.notes ?? "",
            sessionLog: session.sessionLog ?? ""
          }
        : null,
      notes: session?.notes ?? SessionService.getActiveNotes(),
      sessionLog: session?.sessionLog ?? SessionService.getActiveSessionLog(),
      context: {
        session: context,
        campaign
      },
      storyThreads: StoryThreadService.list().map((thread) => ({
        id: thread.id,
        title: thread.title,
        status: thread.status,
        currentState: thread.currentState,
        openQuestions: thread.openQuestions ?? []
      })),
      quests: QuestEntryService.list().map((entry) => ({
        id: entry.id,
        storyThreadId: entry.storyThreadId,
        title: entry.title,
        status: entry.status,
        objective: entry.objective
      })),
      recentActivity: CampaignActivityService.list({ limit: 40 }),
      chronicle: CampaignMemoryService.list()
        .slice()
        .sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0))
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          sessionNumber: entry.sessionNumber,
          title: entry.title,
          excerpt: String(entry.sessionLog ?? "").replace(/\s+/g, " ").trim().slice(0, 280)
        })),
      actors: EntityRegistry.all("actor")
        .slice(0, 80)
        .map((entity) => ({
          uuid: entity.uuid,
          name: entity.name,
          notes: CompanionStorage.getMemory(`actor:${entity.uuid}`) || ""
        })),
      locations: EntityRegistry.all("scene")
        .slice(0, 80)
        .map((entity) => ({
          uuid: entity.uuid,
          name: entity.name,
          notes: CompanionStorage.getMemory(`scene:${entity.uuid}`) || ""
        })),
      extras,
      collectors: SessionCollector.listCollectors()
    };
  }
}
