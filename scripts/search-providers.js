import { CampaignWorkspace } from "./campaign-workspace.js";
import { EntityRegistry } from "./entity-registry.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SearchService } from "./search-service.js";
import { SessionService } from "./session-service.js";
import { ThreadService } from "./thread-service.js";

const ENTITY_GROUPS = Object.freeze({
  actor: "Characters",
  item: "Items",
  scene: "Locations",
  journal: "Journals",
  rollTable: "Roll Tables"
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
        title: session.title || `Session ${session.sessionNumber}`,
        subtitle: `Session ${session.sessionNumber}`,
        group: "Sessions"
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
        group: "Session Entries"
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
        group: "Quests"
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
    id: "quest-entries",
    label: "Quest Entries",
    getItems: () =>
      QuestEntryService.list().map((entry) => ({
        id: entry.id,
        title: entry.title?.trim() || "Untitled Entry",
        subtitle: ThreadService.getById(entry.questId)?.title || "Quest Entry",
        group: "Quest Entries"
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
