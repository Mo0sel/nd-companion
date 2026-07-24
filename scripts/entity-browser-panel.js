/**
 * Thin entity browsers for NPCs / Locations nav destinations.
 */

import { EntityRegistry } from "./entity-registry.js";

export class EntityBrowserPanel {
  /**
   * @param {HTMLElement} container
   * @param {"actor"|"scene"} kind
   * @param {{ onOpen?: (kind: string, uuid: string) => void }} [options]
   */
  static paint(container, kind, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const label = kind === "scene" ? "Locations" : "NPCs";
    const entities = EntityRegistry.all(kind)
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const root = document.createElement("div");
    root.className = "nd-entity-browser";

    const header = document.createElement("header");
    header.className = "nd-entity-browser__header";
    header.innerHTML = `<h2>${label}</h2><p>${entities.length} in this world</p>`;
    root.append(header);

    const list = document.createElement("div");
    list.className = "nd-entity-browser__list";
    if (!entities.length) {
      const empty = document.createElement("p");
      empty.className = "nd-entity-browser__empty";
      empty.textContent = `No ${label.toLowerCase()} found.`;
      list.append(empty);
    } else {
      for (const entity of entities) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "nd-entity-browser__row";
        row.textContent = entity.name || "Untitled";
        row.addEventListener("click", () => options.onOpen?.(kind, entity.uuid));
        list.append(row);
      }
    }
    root.append(list);
    container.replaceChildren(root);
  }
}
