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
   * @param {{
   *   showCampaignMemory?: boolean,
   *   showCurrentStatus?: boolean,
   *   showHeader?: boolean
   * }} [options]
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
    const hasStatus = options.showCurrentStatus !== false && Boolean(statusKey);
    const hasMemory =
      options.showCampaignMemory !== false && RichText.hasContent(context.campaignMemory);
    const hasKnowledge = Boolean(
      context.lastSeen ||
      context.sessions.length ||
      context.quests.length ||
      context.questEntries.length ||
      context.actors.length ||
      context.locations.length ||
      context.items.length ||
      context.storyThreads.length ||
      context.factions.length
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
      title.textContent = "DM Notes";
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
      knowledge.textContent = "Campaign History";
      container.append(knowledge);

      if (context.sessions.length) {
        const history = ContextPanel.#section("History");
        history.append(ContextPanel.#timeline(context.sessions, context.lastSeen));
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

        const toggle = target.closest("[data-context-timeline-toggle]");
        if (toggle instanceof HTMLButtonElement) {
          event.preventDefault();
          ContextPanel.#toggleTimeline(toggle);
          return;
        }

        const mention = target.closest("[data-nd-mention]");
        if (mention instanceof HTMLElement) {
          const mentionTarget = ContextPanel.#mentionTarget(mention);
          if (mentionTarget) {
            event.preventDefault();
            void Promise.resolve(onNavigate(mentionTarget));
          }
          return;
        }

        const link = target.closest("[data-context-kind][data-context-id]");
        if (!link) return;
        const kind = link.getAttribute("data-context-kind");
        const id = link.getAttribute("data-context-id");
        if (kind && id) void Promise.resolve(onNavigate({ kind, id }));
      },
      { signal: controller.signal }
    );
    root.addEventListener(
      "keydown",
      (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.hasAttribute("data-nd-mention")) return;
        event.preventDefault();
        target.click();
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
      ["Story Threads", context.storyThreads],
      ["Factions", context.factions],
      ["Actors", context.actors],
      ["Locations", context.locations],
      ["Items", context.items],
      ["Quests", context.quests],
      ["Quests", context.questEntries]
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

  static #timeline(sessions, lastSeen) {
    const timeline = document.createElement("div");
    timeline.className = "nd-context-timeline";

    for (const session of sessions) {
      const item = document.createElement("article");
      item.className = "nd-context-timeline__item";
      item.dataset.contextTimelineSession = session.id;
      item.classList.toggle("is-last-seen", session.id === lastSeen?.id);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "nd-context-timeline__toggle";
      toggle.dataset.contextTimelineToggle = session.id;
      toggle.setAttribute("aria-expanded", "false");

      const marker = document.createElement("span");
      marker.className = "nd-context-timeline__marker";
      marker.setAttribute("aria-hidden", "true");
      const summary = document.createElement("span");
      summary.className = "nd-context-timeline__summary";
      const number = document.createElement("span");
      number.className = "nd-context-panel__session-number";
      number.textContent = `Session ${session.sessionNumber}`;
      const title = document.createElement("strong");
      title.className = "nd-context-panel__session-title";
      title.textContent = session.title?.trim() || "Untitled Session";
      summary.append(number, title);
      if (session.id === lastSeen?.id) {
        const badge = document.createElement("span");
        badge.className = "nd-context-timeline__badge";
        badge.textContent = "Last Seen";
        summary.append(badge);
      }
      toggle.append(marker, summary);

      const preview = document.createElement("div");
      preview.className = "nd-context-timeline__preview";
      preview.hidden = true;
      const log = document.createElement("div");
      log.className = "nd-context-timeline__log nd-richtext";
      log.innerHTML = RichText.sanitize(session.sessionLog ?? "");
      log.querySelectorAll("[data-nd-mention]").forEach((mention) => {
        mention.setAttribute("role", "link");
        mention.setAttribute("tabindex", "0");
        mention.setAttribute("title", "Open this campaign entity");
      });

      const actions = document.createElement("div");
      actions.className = "nd-context-timeline__actions";
      const open = ContextPanel.#link(session);
      open.classList.add("nd-context-timeline__open");
      open.textContent = "Open Full Chronicle →";
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "nd-context-timeline__collapse";
      collapse.dataset.contextTimelineToggle = session.id;
      collapse.textContent = "Collapse";
      actions.append(open, collapse);
      preview.append(log, actions);
      item.append(toggle, preview);
      timeline.append(item);
    }
    return timeline;
  }

  static #toggleTimeline(toggle) {
    const timeline = toggle.closest(".nd-context-timeline");
    const item = toggle.closest("[data-context-timeline-session]");
    if (!(timeline instanceof HTMLElement) || !(item instanceof HTMLElement)) return;
    const willOpen = !item.classList.contains("is-expanded");

    timeline.querySelectorAll("[data-context-timeline-session]").forEach((entry) => {
      const expanded = willOpen && entry === item;
      entry.classList.toggle("is-expanded", expanded);
      const entryToggle = entry.querySelector(".nd-context-timeline__toggle");
      const preview = entry.querySelector(".nd-context-timeline__preview");
      entryToggle?.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (preview instanceof HTMLElement) {
        preview.hidden = !expanded;
        if (expanded) {
          requestAnimationFrame(() => {
            const log = preview.querySelector(".nd-context-timeline__log");
            if (log instanceof HTMLElement) {
              log.classList.toggle("is-truncated", log.scrollHeight > log.clientHeight);
            }
          });
        }
      }
    });
  }

  static #mentionTarget(mention) {
    const rawKind = mention.dataset.mentionKind;
    const id = mention.dataset.mentionUuid || mention.dataset.mentionId;
    if (!rawKind || !id) return null;
    const kind = rawKind === "scene" ? "location" : rawKind;
    return { kind, id };
  }
}
