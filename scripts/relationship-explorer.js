import { NavigationHistory } from "./navigation-history.js";

/**
 * Unified Connected Knowledge browser over ContextEngine results.
 * Owns no storage — only presentation and navigation chrome.
 */
export class RelationshipExplorer {
  /** @type {Set<string>} */
  static #expandedGroups = new Set([
    "storyThreads",
    "quests",
    "actors",
    "factions"
  ]);

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * Ordered relationship groups for one ContextEngine result.
   * @param {import("./context-engine.js").ContextResult} context
   * @returns {Array<{ key: string, label: string, nodes: object[] }>}
   */
  static groupsFrom(context) {
    if (!context) return [];
    const quests = RelationshipExplorer.#mergeNodes(
      context.questEntries ?? [],
      context.quests ?? []
    );
    return [
      { key: "storyThreads", label: "Story Threads", nodes: context.storyThreads ?? [] },
      { key: "quests", label: "Quests", nodes: quests },
      { key: "actors", label: "Actors", nodes: context.actors ?? [] },
      { key: "factions", label: "Factions", nodes: context.factions ?? [] },
      { key: "locations", label: "Locations", nodes: context.locations ?? [] },
      { key: "items", label: "Items", nodes: context.items ?? [] },
      { key: "chronicle", label: "Chronicle", nodes: context.sessions ?? [] }
    ]
      .map((group) => ({
        ...group,
        nodes: [...group.nodes].sort((a, b) =>
          RelationshipExplorer.#nodeLabel(a).localeCompare(
            RelationshipExplorer.#nodeLabel(b)
          )
        )
      }))
      .filter((group) => group.nodes.length > 0);
  }

  /**
   * @param {HTMLElement|null} container
   * @param {import("./context-engine.js").ContextResult} context
   * @param {{ heading?: string }} [options]
   */
  static paint(container, context, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();
    container.className = "nd-relationship-explorer";
    container.dataset.relationshipExplorer = "";

    const heading = document.createElement("h4");
    heading.className = "nd-relationship-explorer__heading";
    heading.textContent = options.heading ?? "Connected Knowledge";
    container.append(heading);

    const groups = RelationshipExplorer.groupsFrom(context);
    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "nd-relationship-explorer__empty";
      empty.textContent = "No related campaign knowledge.";
      const hint = document.createElement("p");
      hint.className = "nd-relationship-explorer__hint";
      hint.textContent = "Use @ mentions to connect this entity with others.";
      container.append(empty, hint);
      return;
    }

    for (const group of groups) {
      container.append(RelationshipExplorer.#groupElement(group));
    }
  }

  /**
   * Back / Forward + breadcrumbs for the campaign main panel.
   * @param {HTMLElement|null} root
   */
  static paintChrome(root) {
    if (!(root instanceof HTMLElement)) return;
    const nav = root.querySelector("[data-relationship-nav]");
    if (!(nav instanceof HTMLElement)) return;

    const trail = NavigationHistory.trail();
    nav.hidden = trail.length === 0;

    const back = nav.querySelector("[data-relationship-back]");
    const forward = nav.querySelector("[data-relationship-forward]");
    if (back instanceof HTMLButtonElement) {
      back.disabled = !NavigationHistory.canBack();
    }
    if (forward instanceof HTMLButtonElement) {
      forward.disabled = !NavigationHistory.canForward();
    }

    const crumbs = nav.querySelector("[data-relationship-crumbs]");
    if (!(crumbs instanceof HTMLElement)) return;
    crumbs.replaceChildren();
    trail.forEach((entry, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "nd-relationship-nav__sep";
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = ">";
        crumbs.append(sep);
      }
      const isCurrent = index === trail.length - 1;
      if (isCurrent) {
        const current = document.createElement("span");
        current.className = "nd-relationship-nav__crumb is-current";
        current.innerHTML =
          `<span class="nd-relationship-nav__kind">${RelationshipExplorer.kindLabel(entry.kind)}</span>` +
          `<strong>${foundry.utils.escapeHTML(entry.label)}</strong>`;
        crumbs.append(current);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-relationship-nav__crumb";
      button.dataset.relationshipCrumb = String(index);
      button.innerHTML =
        `<span class="nd-relationship-nav__kind">${RelationshipExplorer.kindLabel(entry.kind)}</span>` +
        `<strong>${foundry.utils.escapeHTML(entry.label)}</strong>`;
      crumbs.append(button);
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {{
   *   onBack?: () => Promise<void>|void,
   *   onForward?: () => Promise<void>|void,
   *   onJump?: (index: number) => Promise<void>|void
   * }} handlers
   */
  static attach(root, handlers = {}) {
    if (!(root instanceof HTMLElement)) return;
    RelationshipExplorer.#listeners.get(root)?.abort();
    const controller = new AbortController();
    RelationshipExplorer.#listeners.set(root, controller);

    root.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest("[data-relationship-back]")) {
          event.preventDefault();
          void Promise.resolve(handlers.onBack?.());
          return;
        }
        if (target.closest("[data-relationship-forward]")) {
          event.preventDefault();
          void Promise.resolve(handlers.onForward?.());
          return;
        }
        const crumb = target.closest("[data-relationship-crumb]");
        if (crumb) {
          const index = Number(crumb.getAttribute("data-relationship-crumb"));
          if (Number.isInteger(index)) void Promise.resolve(handlers.onJump?.(index));
        }
      },
      { signal: controller.signal }
    );
  }

  /** @param {string} kind */
  static kindLabel(kind) {
    switch (kind) {
      case "storyThread":
        return "Story Thread";
      case "questEntry":
      case "quest":
      case "beat":
        return "Quest";
      case "actor":
        return "Actor";
      case "faction":
        return "Faction";
      case "location":
      case "scene":
        return "Location";
      case "item":
        return "Item";
      case "session":
        return "Chronicle";
      default:
        return "Entity";
    }
  }

  static #groupElement(group) {
    const details = document.createElement("details");
    details.className = "nd-relationship-explorer__group";
    details.dataset.relationshipGroup = group.key;
    details.open = RelationshipExplorer.#expandedGroups.has(group.key);

    const summary = document.createElement("summary");
    summary.className = "nd-relationship-explorer__summary";
    const label = document.createElement("span");
    label.textContent = `${group.label} (${group.nodes.length})`;
    summary.append(label);

    const list = document.createElement("div");
    list.className = "nd-relationship-explorer__links";
    for (const node of group.nodes) {
      list.append(RelationshipExplorer.#link(node));
    }
    details.append(summary, list);

    details.addEventListener("toggle", () => {
      if (details.open) RelationshipExplorer.#expandedGroups.add(group.key);
      else RelationshipExplorer.#expandedGroups.delete(group.key);
    });
    return details;
  }

  static #link(node) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nd-context-panel__link nd-relationship-explorer__link";
    button.dataset.contextKind = node.kind;
    button.dataset.contextId = node.id;
    button.textContent = RelationshipExplorer.#nodeLabel(node);
    return button;
  }

  static #nodeLabel(node) {
    if (node?.kind === "session") {
      const title = node.title?.trim();
      return title
        ? `Session ${node.sessionNumber} · ${title}`
        : `Session ${node.sessionNumber}`;
    }
    return node?.label?.trim() || "Untitled";
  }

  static #mergeNodes(...lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
      for (const node of list) {
        const key = `${node.kind}:${node.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(node);
      }
    }
    return out;
  }
}
