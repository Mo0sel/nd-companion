import { NavigationHistory } from "./navigation-history.js";
import { QuickEdit } from "./quick-edit.js";
import { RelationshipPicker } from "./relationship-picker.js";

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

  /** @type {{ kind: string, id: string }|null} */
  static #pendingHighlight = null;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * Ordered relationship groups for one ContextEngine result.
   * Empty groups are kept when building management UI so types stay visible
   * after adds; callers filter for display as needed.
   * @param {import("./context-engine.js").ContextResult} context
   * @param {{ includeEmpty?: boolean }} [options]
   * @returns {Array<{ key: string, label: string, nodes: object[] }>}
   */
  static groupsFrom(context, options = {}) {
    if (!context) return [];
    const quests = RelationshipExplorer.#mergeNodes(
      context.questEntries ?? [],
      context.quests ?? []
    );
    const groups = [
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
      }));
    return options.includeEmpty
      ? groups
      : groups.filter((group) => group.nodes.length > 0);
  }

  /**
   * Highlight a relationship chip on the next paint.
   * @param {{ kind: string, id: string }} target
   */
  static highlightNext(target) {
    if (!target?.kind || !target?.id) return;
    RelationshipExplorer.#pendingHighlight = {
      kind: target.kind,
      id: target.id
    };
    const groupKey = RelationshipExplorer.#groupKeyForKind(target.kind);
    if (groupKey) RelationshipExplorer.#expandedGroups.add(groupKey);
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
    if (context?.target?.kind && context?.target?.id) {
      container.dataset.relationshipOwnerKind = context.target.kind;
      container.dataset.relationshipOwnerId = context.target.id;
    }

    const heading = document.createElement("h4");
    heading.className = "nd-relationship-explorer__heading";
    heading.textContent = options.heading ?? "Connected Knowledge";
    container.append(heading);

    const groups = RelationshipExplorer.groupsFrom(context);
    const highlight = RelationshipExplorer.#pendingHighlight;
    RelationshipExplorer.#pendingHighlight = null;

    if (!groups.length) {
      container.append(RelationshipExplorer.#emptyState(Boolean(context?.target)));
    } else {
      for (const group of groups) {
        container.append(
          RelationshipExplorer.#groupElement(group, context?.target, highlight)
        );
      }
    }

    if (context?.target?.kind && context?.target?.id) {
      container.append(
        RelationshipExplorer.#addRelationship(context, groups)
      );
    }

    if (highlight) {
      requestAnimationFrame(() => {
        const groupKey = RelationshipExplorer.#groupKeyForKind(highlight.kind);
        const group = groupKey
          ? container.querySelector(`[data-relationship-group="${groupKey}"]`)
          : null;
        if (group instanceof HTMLDetailsElement) {
          group.open = true;
          group.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        const chip = [...container.querySelectorAll("[data-relationship-chip]")].find(
          (entry) =>
            entry instanceof HTMLElement &&
            entry.dataset.contextKind === highlight.kind &&
            entry.dataset.contextId === highlight.id
        );
        if (!(chip instanceof HTMLElement)) return;
        chip.classList.add("is-highlighted");
        chip.scrollIntoView({ block: "nearest", behavior: "smooth" });
        window.setTimeout(() => chip.classList.remove("is-highlighted"), 1600);
      });
    }
  }

  static #emptyState(canAdd) {
    const empty = document.createElement("div");
    empty.className = "nd-relationship-explorer__empty-state";

    const title = document.createElement("p");
    title.className = "nd-relationship-explorer__empty";
    title.textContent = "No relationships yet.";

    const hint = document.createElement("p");
    hint.className = "nd-relationship-explorer__hint";
    hint.textContent =
      "Link Actors, Factions, Locations, and Quests so you can jump between related knowledge during prep and play.";

    empty.append(title, hint);
    if (canAdd) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-relationship-explorer__first-add";
      button.dataset.relationshipOpenPicker = "";
      button.textContent = "+ Add First Relationship";
      empty.append(button);
    }
    return empty;
  }

  /**
   * @param {import("./context-engine.js").ContextResult} context
   * @param {Array<{ key: string, nodes: object[] }>} groups
   */
  static #addRelationship(context, groups) {
    const wrap = document.createElement("div");
    wrap.className = "nd-relationship-explorer__add";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nd-relationship-explorer__add-btn";
    toggle.dataset.relationshipOpenPicker = "";
    toggle.textContent = "+ Add Relationship";

    const pickerHost = document.createElement("div");
    pickerHost.className = "nd-relationship-explorer__picker-host";
    pickerHost.dataset.relationshipPickerHost = "";
    pickerHost.hidden = true;

    const related = new Set();
    for (const group of groups) {
      for (const node of group.nodes) {
        related.add(`${node.kind}:${node.id}`);
      }
    }
    if (context.target) {
      related.add(`${context.target.kind}:${context.target.id}`);
    }

    RelationshipPicker.mount(pickerHost, {
      exclude: [...related].map((key) => {
        const separator = key.indexOf(":");
        return {
          kind: key.slice(0, separator),
          id: key.slice(separator + 1)
        };
      }),
      onSelect: (entry) => {
        pickerHost.dispatchEvent(new CustomEvent("nd-relationship-pick", {
          bubbles: true,
          detail: entry
        }));
      }
    });

    wrap.append(toggle, pickerHost);
    return wrap;
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
          `<span class="nd-relationship-nav__kind" data-entity-kind="${foundry.utils.escapeHTML(entry.kind)}">${RelationshipExplorer.kindLabel(entry.kind)}</span>` +
          `<strong>${foundry.utils.escapeHTML(entry.label)}</strong>`;
        crumbs.append(current);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-relationship-nav__crumb";
      button.dataset.relationshipCrumb = String(index);
      button.innerHTML =
        `<span class="nd-relationship-nav__kind" data-entity-kind="${foundry.utils.escapeHTML(entry.kind)}">${RelationshipExplorer.kindLabel(entry.kind)}</span>` +
        `<strong>${foundry.utils.escapeHTML(entry.label)}</strong>`;
      crumbs.append(button);
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {{
   *   onBack?: () => Promise<void>|void,
   *   onForward?: () => Promise<void>|void,
   *   onJump?: (index: number) => Promise<void>|void,
   *   onRefresh?: (detail?: { highlight?: { kind: string, id: string } }) => void
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
          return;
        }

        const openPicker = target.closest("[data-relationship-open-picker]");
        if (openPicker) {
          event.preventDefault();
          event.stopPropagation();
          const explorer = openPicker.closest("[data-relationship-explorer]");
          const host = explorer?.querySelector("[data-relationship-picker-host]");
          if (host instanceof HTMLElement) {
            host.hidden = !host.hidden;
            if (!host.hidden) {
              host.querySelector("[data-relationship-picker-search]")?.focus();
            }
          } else if (explorer) {
            // Empty state button — reveal add section by ensuring picker host exists after paint.
            const add = explorer.querySelector("[data-relationship-picker-host]");
            if (add instanceof HTMLElement) {
              add.hidden = false;
              add.querySelector("[data-relationship-picker-search]")?.focus();
            }
          }
          return;
        }

        const remove = target.closest("[data-relationship-remove]");
        if (remove) {
          event.preventDefault();
          event.stopPropagation();
          void RelationshipExplorer.#onRemove(remove, handlers);
          return;
        }

        const open = target.closest("[data-relationship-open]");
        if (open) {
          // Let ContextPanel navigation handle data-context-kind/id on the chip.
          return;
        }
      },
      { signal: controller.signal }
    );

    root.addEventListener(
      "nd-relationship-pick",
      (event) => {
        const custom = /** @type {CustomEvent} */ (event);
        void RelationshipExplorer.#onPick(custom, handlers);
      },
      { signal: controller.signal }
    );
  }

  static async #onPick(event, handlers) {
    try {
      const explorer = event.target instanceof Element
        ? event.target.closest("[data-relationship-explorer]")
        : null;
      if (!(explorer instanceof HTMLElement)) return;
      const ownerKind = explorer.dataset.relationshipOwnerKind;
      const ownerId = explorer.dataset.relationshipOwnerId;
      const entry = event.detail;
      if (!ownerKind || !ownerId || !entry?.kind || !entry?.id) return;

      const ok = await QuickEdit.addRelationship(
        { kind: ownerKind, id: ownerId },
        { kind: entry.kind, id: entry.id }
      );
      if (!ok) {
        ui.notifications?.warn("Could not add that relationship.");
        return;
      }
      RelationshipExplorer.highlightNext({ kind: entry.kind, id: entry.id });
      handlers.onRefresh?.({ highlight: { kind: entry.kind, id: entry.id } });
    } catch (error) {
      console.error("N&D Companion: relationship pick failed", error);
      ui.notifications?.error("Relationship could not be created.");
    }
  }

  static async #onRemove(button, handlers) {
    const chip = button.closest("[data-relationship-chip]");
    const explorer = button.closest("[data-relationship-explorer]");
    if (!(chip instanceof HTMLElement) || !(explorer instanceof HTMLElement)) return;
    const ownerKind = explorer.dataset.relationshipOwnerKind;
    const ownerId = explorer.dataset.relationshipOwnerId;
    const kind = chip.dataset.contextKind;
    const id = chip.dataset.contextId;
    const label = chip.dataset.relationshipLabel || "this relationship";
    if (!ownerKind || !ownerId || !kind || !id) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remove Relationship" },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(label)}</strong> from Connected Knowledge?</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;

    const ok = await QuickEdit.removeRelationship(
      { kind: ownerKind, id: ownerId },
      { kind, id }
    );
    if (!ok) {
      ui.notifications?.warn("That relationship could not be removed.");
      return;
    }
    handlers.onRefresh?.();
  }

  /** @param {string} kind */
  static kindLabel(kind) {
    return RelationshipPicker.typeLabel(kind);
  }

  static #groupElement(group, owner, highlight) {
    const details = document.createElement("details");
    details.className = "nd-relationship-explorer__group";
    details.dataset.relationshipGroup = group.key;
    const forceOpen = highlight
      && RelationshipExplorer.#groupKeyForKind(highlight.kind) === group.key;
    details.open = forceOpen || RelationshipExplorer.#expandedGroups.has(group.key);

    const summary = document.createElement("summary");
    summary.className = "nd-relationship-explorer__summary";
    const type = document.createElement("span");
    type.className = "nd-rel-type";
    if (group.key === "storyThreads") type.dataset.relType = "storyThread";
    else if (group.key === "quests") type.dataset.relType = "quest";
    else if (group.key === "actors") type.dataset.relType = "actor";
    else if (group.key === "factions") type.dataset.relType = "faction";
    else if (group.key === "locations") type.dataset.relType = "location";
    else if (group.key === "items") type.dataset.relType = "item";
    else if (group.key === "chronicle") type.dataset.relType = "chronicle";
    else type.dataset.relType = group.key;
    type.textContent = RelationshipPicker.typeLabel(type.dataset.relType);
    const label = document.createElement("span");
    label.className = "nd-relationship-explorer__group-label";
    label.textContent = `${group.label.toUpperCase()} (${group.nodes.length})`;
    summary.append(type, label);

    const list = document.createElement("div");
    list.className = "nd-relationship-explorer__links";
    for (const node of group.nodes) {
      list.append(RelationshipExplorer.#chip(node, owner, type.dataset.relType));
    }
    details.append(summary, list);

    details.addEventListener("toggle", () => {
      if (details.open) RelationshipExplorer.#expandedGroups.add(group.key);
      else RelationshipExplorer.#expandedGroups.delete(group.key);
    });
    return details;
  }

  static #chip(node, owner, groupType) {
    const chip = document.createElement("div");
    chip.className = "nd-relationship-explorer__chip";
    chip.dataset.relationshipChip = "";
    chip.dataset.contextKind = node.kind;
    chip.dataset.contextId = node.id;
    chip.dataset.relationshipLabel = RelationshipExplorer.#nodeLabel(node);

    const dot = document.createElement("span");
    dot.className = "nd-rel-dot";
    dot.dataset.relType = groupType || RelationshipPicker.typeKey(node.kind);
    dot.setAttribute("aria-hidden", "true");

    const open = document.createElement("button");
    open.type = "button";
    open.className = "nd-relationship-explorer__chip-open";
    open.dataset.relationshipOpen = "";
    open.dataset.contextKind = node.kind;
    open.dataset.contextId = node.id;
    open.textContent = RelationshipExplorer.#nodeLabel(node);
    open.title = "Open";

    chip.append(dot, open);

    if (owner && QuickEdit.canRemoveRelationship(owner, node)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "nd-relationship-explorer__chip-remove";
      remove.dataset.relationshipRemove = "";
      remove.setAttribute("aria-label", `Remove ${RelationshipExplorer.#nodeLabel(node)}`);
      remove.title = "Remove";
      remove.textContent = "×";
      chip.append(remove);
    }

    return chip;
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

  static #groupKeyForKind(kind) {
    switch (RelationshipPicker.typeKey(kind)) {
      case "storyThread":
        return "storyThreads";
      case "quest":
        return "quests";
      case "actor":
        return "actors";
      case "faction":
        return "factions";
      case "location":
        return "locations";
      case "item":
        return "items";
      case "chronicle":
        return "chronicle";
      default:
        return "";
    }
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
