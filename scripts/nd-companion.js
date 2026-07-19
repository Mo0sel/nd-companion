import { CompanionApp } from "./companion-app.js";
import { CampaignAwareness } from "./campaign-context.js";
import { CampaignDocument } from "./campaign-document.js";
import { CampaignMemoryService } from "./campaign-memory-service.js";
import { ContextEngine } from "./context-engine.js";
import { EntityRegistry } from "./entity-registry.js";
import { FocusManager } from "./focus-manager.js";
import { Navigation } from "./navigation.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SessionService } from "./session-service.js";
import { registerSearchProviders } from "./search-providers.js";
import { SearchService } from "./search-service.js";
import { CompanionStorage } from "./storage.js";
import { ThreadService } from "./thread-service.js";

Hooks.once("init", () => {
  console.log("%cN&D Companion", "color:#7dd3fc;font-size:16px;font-weight:bold;");
  console.log("N&D Companion initialized.");
  CompanionStorage.register();
});

Hooks.once("ready", async () => {
  console.log("N&D Companion ready.");
  EntityRegistry.ready();
  EntityRegistry.registerHooks();
  // Beats first (stable ids), then campaign migration + session bridge.
  await PlaybookService.ready();
  await CampaignDocument.ready();
  await SessionService.ready();
  registerSearchProviders();
  window.nd ??= {};
  window.nd.EntityRegistry = EntityRegistry;
  window.nd.FocusManager = FocusManager;
  window.nd.Navigation = Navigation;
  window.nd.QuestEntryService = QuestEntryService;
  window.nd.SessionService = SessionService;
  window.nd.ThreadService = ThreadService;
  window.nd.CampaignDocument = CampaignDocument;
  window.nd.CampaignMemoryService = CampaignMemoryService;
  window.nd.ContextEngine = ContextEngine;
  window.nd.SearchService = SearchService;
  CampaignAwareness.registerHooks();
  FocusManager.registerHooks();
});

Hooks.on("getSceneControlButtons", (controls) => {
  const group = controls.tokens;
  if (!group?.tools) return;

  group.tools["nd-companion"] = {
    name: "nd-companion",
    title: "N&D Companion",
    icon: "fa-solid fa-brain",
    order: Object.keys(group.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => {
      const existing = foundry.applications.instances.get("nd-companion-app");
      if (existing) existing.bringToFront();
      else new CompanionApp().render({ force: true });
    }
  };
});
