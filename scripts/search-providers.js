import { CampaignActivityService } from "./campaign-activity-service.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { CampaignWorkspace } from "./campaign-workspace.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SearchService } from "./search-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";

const ENTITY_GROUPS = Object.freeze({
  actor: "ACTOR",
  item: "ITEM",
  scene: "LOCATION",
  journal: "JOURNAL",
  rollTable: "ROLL TABLE"
});

/**
 * @param {string} entityKind
 * @param {string} entityId
 * @param {string} [fallback]
 */
function activitySubtitle(entityKind, entityId, fallback = "") {
  const latest = CampaignActivityService.latestFor(entityKind, entityId);
  if (!latest) return fallback;
  return `${CampaignActivityService.actionLabel(latest.action)} ${CampaignActivityService.formatRelative(latest.timestamp)}`;
}

/**
 * Register current campaign domains with universal search.
 */
export function registerSearchProviders() {
  SearchService.registerProvider({
    id: "sessions",
    label: "Sessions",
    getItems: () =>
      SessionService.list().map((session) => ({
        id: session.id,
        title: CampaignMemoryService.label(session),
        subtitle: session.status === "active"
          ? "Current Session"
          : session.source === "imported" ? "Imported" : "Live",
        group: "SESSION"
      })),
    getQuickAccess: () => {
      const session = SessionService.getActive();
      return session
        ? [{
            id: session.id,
            title: session.title || `Session ${session.sessionNumber}`,
            subtitle: "Current Session"
          }]
        : [];
    },
    open: (id, context) => {
      context.openSession(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "beats",
    label: "Session Entries",
    getItems: () =>
      PlaybookService.getDocument().beats.map((beat) => ({
        id: beat.id,
        title: beat.title?.trim() || "Untitled Entry",
        subtitle: "Prepared Entry",
        group: "SESSION ENTRY"
      })),
    getQuickAccess: () => {
      const current = PlaybookService.getCurrent();
      const beat = current.beat;
      return current.total > 0 && beat?.id
        ? [{
            id: beat.id,
            title: beat.title?.trim() || "Untitled Entry",
            subtitle: "Current Entry"
          }]
        : [];
    },
    open: (id, context) => {
      context.openBeat(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "quests",
    label: "Quests",
    getItems: () =>
      QuestEntryService.list().map((entry) => ({
        id: entry.id,
        title: entry.title?.trim() || "Untitled Quest",
        subtitle: activitySubtitle(
          "questEntry",
          entry.id,
          StoryThreadService.getById(entry.storyThreadId)?.title || "Quest"
        ),
        group: "QUEST"
      })),
    getQuickAccess: () => {
      const id = CampaignWorkspace.getSelectedQuestEntryId?.();
      const entry = id ? QuestEntryService.getById(id) : null;
      return entry
        ? [{
            id: entry.id,
            title: entry.title?.trim() || "Untitled Quest",
            subtitle: "Current Quest"
          }]
        : [];
    },
    open: (id, context) => {
      context.openQuestEntry(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "story-threads",
    label: "Story Threads",
    getItems: () =>
      StoryThreadService.list().map((thread) => ({
        id: thread.id,
        title: thread.title?.trim() || "Untitled Story Thread",
        subtitle: activitySubtitle("storyThread", thread.id, thread.status),
        group: "STORY THREAD"
      })),
    open: (id, context) => {
      context.openStoryThread(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "factions",
    label: "Factions",
    getItems: () =>
      FactionService.list().map((faction) => ({
        id: faction.id,
        title: faction.name?.trim() || "Untitled Faction",
        subtitle: activitySubtitle("faction", faction.id, faction.playerReputation),
        group: "FACTION"
      })),
    open: (id, context) => {
      context.openFaction(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "campaign-activity",
    label: "Campaign Activity",
    getItems: () =>
      CampaignActivityService.list({ limit: 100 }).map((event) => ({
        id: `${event.entityKind}:${event.entityId}:${event.id}`,
        title: event.entityName,
        subtitle: [
          CampaignActivityService.entityTypeLabel(event.entityKind),
          CampaignActivityService.actionLabel(event.action),
          CampaignActivityService.formatRelative(event.timestamp)
        ].join(" · "),
        group: "ACTIVITY"
      })),
    open: (id, context) => {
      const [kind, entityId] = String(id).split(":");
      if (!kind || !entityId) return false;
      return context.openActivityEntity?.({ kind, id: entityId }) ?? false;
    }
  });

  SearchService.registerProvider({
    id: "entities",
    label: "Entities",
    getItems: () =>
      EntityRegistry.kinds().flatMap((kind) =>
        EntityRegistry.all(kind).map((entity) => ({
          id: entity.uuid,
          title: entity.name,
          subtitle: activitySubtitle(
            kind === "scene" ? "location" : kind,
            entity.uuid,
            ENTITY_GROUPS[kind] ?? kind
          ),
          group: ENTITY_GROUPS[kind] ?? SearchProvidersLabel.fromKind(kind)
        }))
      ),
    open: (uuid, context) => {
      const entity = EntityRegistry.findByUUID(uuid);
      if (!entity) {
        context.notify("That campaign entity is no longer available.");
        return false;
      }
      return context.openEntity(uuid, entity.kind);
    }
  });
}

class SearchProvidersLabel {
  static fromKind(kind) {
    return String(kind)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (letter) => letter.toUpperCase());
  }
}
