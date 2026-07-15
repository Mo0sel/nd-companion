import { CompanionApp } from "./companion-app.js";
import { CampaignAwareness } from "./campaign-context.js";
import { EntityRegistry } from "./entity-registry.js";
import { FocusManager } from "./focus-manager.js";
import { Navigation } from "./navigation.js";
import { CompanionStorage } from "./storage.js";

Hooks.once("init", () => {
  console.log("%cN&D Companion", "color:#7dd3fc;font-size:16px;font-weight:bold;");
  console.log("N&D Companion initialized.");
  CompanionStorage.register();
});

Hooks.once("ready", () => {
  console.log("N&D Companion ready.");
  EntityRegistry.ready();
  EntityRegistry.registerHooks();
  window.nd ??= {};
  window.nd.EntityRegistry = EntityRegistry;
  window.nd.FocusManager = FocusManager;
  window.nd.Navigation = Navigation;
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
