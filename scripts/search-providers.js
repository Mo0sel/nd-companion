import { CampaignMemoryService } from "./campaign-memory-service.js";
import { CampaignWorkspace } from "./campaign-workspace.js";
import { EntityRegistry } from "./entity-registry.js";
import { FactionService } from "./faction-service.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SearchService } from "./search-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
import { ThreadService } from "./thread-service.js";

const ENTITY_GROUPS = Object.freeze({
  actor: "ACTOR",
  item: "ITEM",
  scene: "LOCATION",
  journal: "JOURNAL",
  rollTable: "ROLL TABLE"
});

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
      ThreadService.list().map((thread) => ({
        id: thread.id,
        title: thread.title?.trim() || "Untitled Quest",
        subtitle: thread.category || thread.status,
        group: "QUEST"
      })),
    getQuickAccess: () => {
      const id = CampaignWorkspace.getSelectedThreadId();
      const thread = id ? ThreadService.getById(id) : null;
      return thread
        ? [{
            id: thread.id,
            title: thread.title?.trim() || "Untitled Quest",
            subtitle: "Current Quest"
          }]
        : [];
    },
    open: (id, context) => {
      context.openThread(id);
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
        subtitle: thread.status,
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
        subtitle: faction.playerReputation,
        group: "FACTION"
      })),
    open: (id, context) => {
      context.openFaction(id);
      return true;
    }
  });

  SearchService.registerProvider({
    id: "story-entries",
    label: "Scenes",
    getItems: () =>
      QuestEntryService.list().map((entry) => ({
        id: entry.id,
        title: entry.title?.trim() || "Untitled Scene",
        subtitle:
          StoryThreadService.getById(entry.storyThreadId)?.title || "Scene",
        group: "SCENE"
      })),
    open: (id, context) => {
      context.openQuestEntry(id);
      return true;
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
          subtitle: ENTITY_GROUPS[kind] ?? kind,
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
