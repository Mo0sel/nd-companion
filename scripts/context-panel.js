import { ContextEngine } from "./context-engine.js";
import { LiveNotes } from "./live-notes.js";
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
   * @param {{ showCampaignMemory?: boolean, showHeader?: boolean }} [options]
   */
  static paint(container, context, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const previousStatus = container.querySelector("[data-context-current-status]");
    if (previousStatus instanceof HTMLElement) {
      if (document.activeElement === previousStatus) previousStatus.blur();
      LiveNotes.detach(previousStatus);
    }
    container.replaceChildren();
    container.className = "nd-context-panel";

    const statusKey = ContextEngine.currentStatusKey(context.target);
    const hasStatus = Boolean(statusKey);
    const hasMemory =
      options.showCampaignMemory !== false && RichText.hasContent(context.campaignMemory);
    const hasKnowledge = Boolean(
      context.lastSeen ||
      context.sessions.length ||
      context.quests.length ||
      context.questEntries.length ||
      context.actors.length ||
      context.locations.length ||
      context.items.length
    );
    const hasContent = hasStatus || hasKnowledge || hasMemory;
    container.hidden = !hasContent;
    if (!hasContent) return;

    if (options.showHeader !== false) {
      const header = document.createElement("header");
      const eyebrow = document.createElement("div");
      eyebrow.className = "nd-campaign-panel__eyebrow nd-hierarchy-context";
      eyebrow.textContent = "Campaign";
      const title = document.createElement("h3");
      title.className = "nd-hierarchy-group";
      title.textContent = "Campaign Memory";
      header.append(eyebrow, title);
      container.append(header);
    }

    if (hasStatus) {
      const section = ContextPanel.#section("Current Status");
      const editor = document.createElement("div");
      editor.className =
        "nd-context-panel__status nd-richtext nd-richtext--editor";
      editor.dataset.contextCurrentStatus = "";
      editor.dataset.placeholder = "Describe the current state...";
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-label", "Current Status");
      section.append(editor);
      container.append(section);
      LiveNotes.attach(editor, statusKey, {
        memory: true,
        html: true,
        sanitize: RichText.sanitize
      });
    }

    if (hasKnowledge) {
      const knowledge = document.createElement("div");
      knowledge.className = "nd-context-panel__knowledge";
      knowledge.textContent = "Knowledge";
      container.append(knowledge);

      if (context.lastSeen) {
        const section = ContextPanel.#section("Last Seen");
        section.append(ContextPanel.#sessionCard(context.lastSeen, true));
        container.append(section);
      }

      if (context.sessions.length) {
        const history = ContextPanel.#section("History");
        const list = document.createElement("div");
        list.className = "nd-context-panel__history";
        for (const session of context.sessions) {
          list.append(ContextPanel.#sessionCard(session, false));
        }
        history.append(list);
        container.append(history);
      }

      ContextPanel.#appendLinks(container, "Appears In", context.sessions);
      ContextPanel.#appendRelationships(container, context);
    }

    if (hasMemory) {
      const section = ContextPanel.#section("Campaign Notes");
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

  static #appendRelationships(container, context) {
    const groups = [
      ["Quests", context.quests],
      ["Quest Entries", context.questEntries],
      ["Actors", context.actors],
      ["Locations", context.locations],
      ["Items", context.items]
    ].filter(([, nodes]) => nodes.length);
    if (!groups.length) return;

    const section = ContextPanel.#section("Relationships");
    const body = document.createElement("div");
    body.className = "nd-context-panel__relationships";
    for (const [label, nodes] of groups) {
      const group = document.createElement("div");
      const heading = document.createElement("h5");
      heading.textContent = label;
      const links = document.createElement("div");
      links.className = "nd-context-panel__links";
      for (const node of nodes) links.append(ContextPanel.#link(node));
      group.append(heading, links);
      body.append(group);
    }
    section.append(body);
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

  static #sessionCard(session, compact) {
    const button = ContextPanel.#link(session);
    button.classList.add("nd-context-panel__session");
    button.classList.toggle("nd-context-panel__session--compact", compact);
    button.replaceChildren();

    const number = document.createElement("span");
    number.className = "nd-context-panel__session-number";
    number.textContent = `Session ${session.sessionNumber}`;
    const title = document.createElement("strong");
    title.className = "nd-context-panel__session-title";
    title.textContent = session.title?.trim()
      ? `“${session.title.trim()}”`
      : "Untitled Session";
    button.append(number, title);

    if (!compact && session.excerpt) {
      const excerpt = document.createElement("span");
      excerpt.className = "nd-context-panel__session-excerpt";
      excerpt.textContent = session.excerpt;
      button.append(excerpt);
    }
    return button;
  }
}
