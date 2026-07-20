import { CampaignActivityService } from "./campaign-activity-service.js";

/**
 * Reusable Campaign Activity feed renderer.
 */
export class CampaignActivityPanel {
  /**
   * @param {HTMLElement|null} container
   * @param {{
   *   limit?: number,
   *   filter?: "all"|"created"|"edited"|"deleted",
   *   showFilters?: boolean,
   *   compact?: boolean
   * }} [options]
   */
  static paint(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const filter = options.filter ?? "all";
    const limit = options.limit ?? 500;
    const events = CampaignActivityService.list({ filter, limit });

    container.replaceChildren();
    container.className = "nd-activity-panel";
    if (options.compact) container.classList.add("nd-activity-panel--compact");

    if (options.showFilters) {
      const filters = document.createElement("div");
      filters.className = "nd-activity-panel__filters";
      filters.dataset.activityFilters = "";
      for (const entry of [
        ["all", "Everything"],
        ["created", "Created"],
        ["edited", "Edited"],
        ["deleted", "Deleted"]
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.activityFilter = entry[0];
        button.classList.toggle("is-active", entry[0] === filter);
        button.textContent = entry[1];
        filters.append(button);
      }
      container.append(filters);
    }

    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "nd-activity-panel__empty";
      empty.textContent = "No campaign activity yet.";
      container.append(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "nd-activity-panel__list";
    list.dataset.activityList = "";
    for (const event of events) {
      list.append(CampaignActivityPanel.#row(event, options.compact));
    }
    container.append(list);
  }

  /**
   * @param {import("./campaign-activity-service.js").CampaignActivityEvent} event
   * @param {boolean} [compact]
   */
  static #row(event, compact = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nd-activity-row";
    button.dataset.activityOpen = "";
    button.dataset.activityEntityKind = event.entityKind;
    button.dataset.activityEntityId = event.entityId;

    const action = document.createElement("span");
    action.className = "nd-activity-row__action";
    action.dataset.action = event.action;
    action.textContent = CampaignActivityService.actionLabel(event.action);

    const body = document.createElement("span");
    body.className = "nd-activity-row__body";

    const type = document.createElement("span");
    type.className = "nd-activity-row__type";
    type.dataset.entityKind = event.entityKind;
    type.textContent = CampaignActivityService.entityTypeLabel(event.entityKind);

    const name = document.createElement("strong");
    name.className = "nd-activity-row__name";
    name.textContent = event.entityName;

    body.append(type, name);

    if (event.fieldName && !compact) {
      const field = document.createElement("span");
      field.className = "nd-activity-row__field";
      field.textContent = event.fieldName;
      body.append(field);
    }

    const time = document.createElement("span");
    time.className = "nd-activity-row__time";
    time.textContent = CampaignActivityService.formatRelative(event.timestamp);

    button.append(action, body, time);
    return button;
  }

  static refreshAll() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!(app?.element instanceof HTMLElement)) return;
    const root = app.element;
    root.querySelectorAll("[data-campaign-activity]").forEach((container) => {
      if (!(container instanceof HTMLElement)) return;
      CampaignActivityPanel.paint(container, {
        filter: container.dataset.activityFilter ?? "all",
        limit: Number(container.dataset.activityLimit) || 500,
        showFilters: container.hasAttribute("data-activity-show-filters"),
        compact: container.hasAttribute("data-activity-compact")
      });
    });
  }
}
