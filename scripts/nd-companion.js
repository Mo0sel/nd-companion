import { CompanionApp } from "./companion-app.js";

Hooks.once("init", () => {
  console.log("%cN&D Companion", "color:#7dd3fc;font-size:16px;font-weight:bold;");
  console.log("N&D Companion initialized.");
});

Hooks.once("ready", () => {
  console.log("N&D Companion ready.");
});

Hooks.on("getSceneControlButtons", (controls) => {
  controls.tokens.tools["nd-companion"] = {
    name: "nd-companion",
    title: "N&D Companion",
    icon: "fa-solid fa-robot",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => {
      const existing = foundry.applications.instances.get("nd-companion-app");
      if (existing) existing.bringToFront();
      else new CompanionApp().render({ force: true });
    }
  };
});