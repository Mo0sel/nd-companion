import { CompanionApp } from "./companion-app.js";

Hooks.once("ready", () => {
  console.log("THIS IS VERSION 999");

  alert("N&D Companion Loaded!");

  const btn = document.createElement("button");
  btn.textContent = "N&D";
  btn.style.position = "fixed";
  btn.style.top = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = "999999";
  btn.style.background = "red";
  btn.style.color = "white";

  btn.onclick = () => {
    new CompanionApp().render(true);
  };

  document.body.appendChild(btn);

  console.log("N&D TEST END");
});