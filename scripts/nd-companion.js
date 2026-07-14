import { CompanionApp } from "./companion-app.js";

Hooks.once("init", () => {
  console.log("%cN&D Companion", "color:#7dd3fc;font-size:16px;font-weight:bold;");
  console.log("N&D Companion initialized.");
});

Hooks.once("ready", () => {
  console.log("N&D Companion ready.");

  if (!game.user.isGM) return;

  const launcher = document.createElement("button");
  launcher.id = "nd-companion-launcher";
  launcher.type = "button";
  launcher.dataset.tooltip = "N&D Companion";
  launcher.innerHTML = '<i class="fa-solid fa-brain"></i>';
  launcher.addEventListener("click", () => {
    const existing = foundry.applications.instances.get("nd-companion-app");
    if (existing) existing.bringToFront();
    else new CompanionApp().render({ force: true });
  });

  document.body.appendChild(launcher);
});