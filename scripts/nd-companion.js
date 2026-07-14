import { CompanionApp } from "./companion-app.js";

Hooks.once("init", () => {
  console.log("%cN&D Companion", "color:#7dd3fc;font-size:16px;font-weight:bold;");
  console.log("N&D Companion initialized.");
});

Hooks.once("ready", () => {
  console.log("N&D Companion ready.");
  console.log("game.user", game.user);
  console.log("isGM", game.user?.isGM);

  if (!game.user.isGM) {
    console.log("Not GM, aborting.");
    return;
  }

  console.log("Creating launcher");

  const launcher = document.createElement("button");
  launcher.id = "nd-companion-launcher";
  launcher.type = "button";
  launcher.dataset.tooltip = "N&D Companion";
  launcher.innerHTML = '<i class="fa-solid fa-brain"></i>';

  launcher.addEventListener("click", () => {
    console.log("Launcher clicked");
    new CompanionApp().render({ force: true });
  });

  document.body.appendChild(launcher);

  console.log("Launcher appended", launcher);
});