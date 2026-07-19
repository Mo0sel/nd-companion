import { RichText } from "./rich-text.js";

/**
 * Generic renderer for ContextEngine results. It owns no campaign logic.
 */
export class ContextPanel {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement|null} container
   * @param {import("./context-engine.js").ContextResult} context
   * @param {{ showCampaignMemory?: boolean }} [options]
   */
  static paint(container, context, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();
    container.className = "nd-context-panel";

    const hasMemory =
      options.showCampaignMemory !== false && RichText.hasContent(context.campaignMemory);
    const hasContent = Boolean(
      context.lastSeen ||
      context.sessions.length ||
      context.quests.length ||
      context.questEntries.length ||
      context.actors.length ||
      context.locations.length ||
      context.items.length ||
      hasMemory
    );
    container.hidden = !hasContent;
    if (!hasContent) return;

    const header = document.createElement("header");
    const eyebrow = document.createElement("div");
    eyebrow.className = "nd-campaign-panel__eyebrow nd-hierarchy-context";
    eyebrow.textContent = "Campaign Knowledge";
    const title = document.createElement("h3");
    title.className = "nd-hierarchy-group";
    title.textContent = "Context";
    header.append(eyebrow, title);
    container.append(header);

    if (context.lastSeen) {
      const section = ContextPanel.#section("Last Seen");
      const lastSeen = context.lastSeen;
      const meta = document.createElement("dl");
      meta.className = "nd-context-panel__last-seen";
      meta.append(
        ContextPanel.#definition("Session Number", `Session ${lastSeen.sessionNumber}`),
        ContextPanel.#definition("Session Title", lastSeen.title?.trim() || "Untitled")
      );
      section.append(meta, ContextPanel.#link(lastSeen));
      container.append(section);
    }

    ContextPanel.#appendLinks(container, "Appears In", context.sessions);
    ContextPanel.#appendLinks(container, "Related Quests", context.quests);
    ContextPanel.#appendLinks(container, "Related Quest Entries", context.questEntries);
    ContextPanel.#appendLinks(container, "Related Actors", context.actors);
    ContextPanel.#appendLinks(container, "Related Locations", context.locations);
    ContextPanel.#appendLinks(container, "Related Items", context.items);

    if (hasMemory) {
      const section = ContextPanel.#section("Campaign Memory");
      const memory = document.createElement("div");
      memory.className = "nd-context-panel__memory nd-richtext";
      memory.innerHTML = RichText.sanitize(context.campaignMemory);
      section.append(memory);
      container.append(section);
    }
  }

  /**
   * Delegate all context navigation through one application-level callback.
   * @param {HTMLElement} root
   * @param {(target: { kind: string, id: string }) => Promise<void>|void} onNavigate
   */
  static attach(root, onNavigate) {
    if (!(root instanceof HTMLElement) || typeof onNavigate !== "function") return;
    ContextPanel.#listeners.get(root)?.abort();
    const controller = new AbortController();
    ContextPanel.#listeners.set(root, controller);
    root.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("[data-context-kind][data-context-id]");
        if (!link) return;
        const kind = link.getAttribute("data-context-kind");
        const id = link.getAttribute("data-context-id");
        if (kind && id) void Promise.resolve(onNavigate({ kind, id }));
      },
      { signal: controller.signal }
    );
  }

  static #appendLinks(container, heading, nodes) {
    if (!nodes.length) return;
    const section = ContextPanel.#section(heading);
    const list = document.createElement("div");
    list.className = "nd-context-panel__links";
    for (const node of nodes) list.append(ContextPanel.#link(node));
    section.append(list);
    container.append(section);
  }

  static #section(heading) {
    const section = document.createElement("section");
    section.className = "nd-context-panel__section";
    const title = document.createElement("h4");
    title.textContent = heading;
    section.append(title);
    return section;
  }

  static #link(node) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nd-context-panel__link";
    button.dataset.contextKind = node.kind;
    button.dataset.contextId = node.id;
    button.textContent = node.label;
    return button;
  }

  static #definition(term, value) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrapper.append(dt, dd);
    return wrapper;
  }
}
