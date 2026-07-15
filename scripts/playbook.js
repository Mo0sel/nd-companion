import { EntityRegistry } from "./entity-registry.js";
import { Navigation } from "./navigation.js";

/**
 * @typedef {object} PlaybookRelatedRef
 * @property {string} name
 * @property {"actor"|"scene"|"journal"|"rollTable"} [kind]
 */

/**
 * @typedef {object} PlaybookBeat
 * @property {string} title
 * @property {string} objective
 * @property {string} gmNotes
 * @property {PlaybookRelatedRef[]} related
 */

/**
 * @typedef {object} ResolvedRelated
 * @property {string} name
 * @property {boolean} navigable
 * @property {string} [uuid]
 * @property {string} [hint]
 */

/**
 * Read-only Playbook viewer for UX validation.
 * Sample data and beat index live in memory only — no persistence.
 */
export class Playbook {
  /** @type {PlaybookBeat[]} */
  static #beats = [
    {
      title: "Arrive at Millhaven",
      objective: "Establish the grain shortage and meet Sister Elara.",
      gmNotes:
        "Let the party hear rumors at the inn before any combat. Elara is earnest, not mysterious.",
      related: [
        { name: "Sister Elara", kind: "actor" },
        { name: "Millhaven Square", kind: "scene" }
      ]
    },
    {
      title: "The Burned Granary",
      objective: "Inspect the ruins and find the scorched ledger fragment.",
      gmNotes:
        "Investigation DC 13 finds boot prints leading toward the docks. Do not rush the Pale Merchant reveal.",
      related: [
        { name: "Millhaven Granary", kind: "scene" },
        { name: "Scorched Ledger", kind: "journal" }
      ]
    },
    {
      title: "Dockside Threats",
      objective: "Confront Edric's enforcers without losing the ledger fragment.",
      gmNotes:
        "Offer fight, talk, or flight. Maren's secret passage is DC 14 Investigation if they stall.",
      related: [
        { name: "Edric", kind: "actor" },
        { name: "Maren", kind: "actor" },
        { name: "Harbor Docks", kind: "scene" },
        { name: "Missing World NPC", kind: "actor" }
      ]
    },
    {
      title: "The Pale Merchant",
      objective: "Learn why the merchant is buying ruined grain at a premium.",
      gmNotes:
        "He never admits sabotage. He will sell information about the Thornwood silence for a favor.",
      related: [
        { name: "Pale Merchant", kind: "actor" },
        { name: "Merchant Ledger", kind: "journal" }
      ]
    },
    {
      title: "Captain Voss's Sextant",
      objective: "Return or recover the stolen navigational sextant.",
      gmNotes:
        "If already returned, skip to Voss's tip about night landings near Ashfeld.",
      related: [
        { name: "Captain Voss", kind: "actor" },
        { name: "Random Encounters", kind: "rollTable" }
      ]
    },
    {
      title: "Thornwood Silence",
      objective: "Discover what silenced the forest scouts.",
      gmNotes:
        "Ambient dread only — no full reveal yet. One strange nest is enough for this beat.",
      related: [
        { name: "Thornwood Edge", kind: "scene" },
        { name: "Scout Report", kind: "journal" }
      ]
    },
    {
      title: "Letter to Ashfeld",
      objective: "Deliver Sister Elara's letter to Ashfeld without interception.",
      gmNotes:
        "Road encounter optional. If the party open the letter, note the seal is genuine.",
      related: [
        { name: "Sister Elara", kind: "actor" },
        { name: "Ashfeld Road", kind: "scene" }
      ]
    }
  ];

  /** @type {number} */
  static #index = 2;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @returns {{
   *   index: number,
   *   total: number,
   *   canPrev: boolean,
   *   canNext: boolean,
   *   beat: PlaybookBeat,
   *   related: ResolvedRelated[]
   * }}
   */
  static get() {
    const total = Playbook.#beats.length;
    const index = Math.min(Math.max(Playbook.#index, 0), Math.max(total - 1, 0));
    Playbook.#index = index;
    const beat = Playbook.#beats[index] ?? {
      title: "",
      objective: "",
      gmNotes: "",
      related: []
    };

    return {
      index,
      total,
      canPrev: index > 0,
      canNext: index < total - 1,
      beat,
      related: Playbook.#resolveRelated(beat.related ?? [])
    };
  }

  static prev() {
    if (Playbook.#index <= 0) return;
    Playbook.#index -= 1;
    Playbook.refreshOpen();
  }

  static next() {
    if (Playbook.#index >= Playbook.#beats.length - 1) return;
    Playbook.#index += 1;
    Playbook.refreshOpen();
  }

  static refreshOpen() {
    const app = foundry.applications.instances.get("nd-companion-app");
    if (!app?.element) return;
    Playbook.paint(app.element, Playbook.get());
  }

  /**
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static paint(root, snapshot) {
    if (!(root instanceof HTMLElement) || !snapshot) return;

    const panel = root.querySelector("[data-playbook]");
    if (!panel) return;

    const setText = (key, value) => {
      const el = panel.querySelector(`[data-playbook="${key}"]`);
      if (el) el.textContent = value ?? "";
    };

    setText("counter", `${snapshot.index + 1} / ${snapshot.total}`);
    setText("title", snapshot.beat.title);
    setText("objective", snapshot.beat.objective);
    setText("gmNotes", snapshot.beat.gmNotes);

    const prevBtn = panel.querySelector("[data-playbook-nav=\"prev\"]");
    const nextBtn = panel.querySelector("[data-playbook-nav=\"next\"]");
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = !snapshot.canPrev;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = !snapshot.canNext;

    const relatedRoot = panel.querySelector("[data-playbook=\"related\"]");
    const relatedSection = panel.querySelector("[data-playbook-related]");
    if (relatedRoot) {
      relatedRoot.replaceChildren();
      for (const item of snapshot.related) {
        const chip = document.createElement(item.navigable ? "button" : "span");
        chip.className = "nd-playbook__entity";
        chip.textContent = item.name;
        if (item.hint) chip.title = item.hint;

        if (item.navigable && item.uuid) {
          if (chip instanceof HTMLButtonElement) chip.type = "button";
          chip.classList.add("nd-playbook__entity--navigable");
          chip.dataset.playbookEntity = item.uuid;
        } else {
          chip.classList.add("nd-playbook__entity--disabled");
          chip.setAttribute("aria-disabled", "true");
        }

        relatedRoot.append(chip);
      }
    }

    if (relatedSection) {
      relatedSection.hidden = snapshot.related.length === 0;
    }
  }

  /**
   * Bind prev/next and related-entity clicks. Safe to call on each render.
   * @param {HTMLElement} root
   */
  static attach(root) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-playbook]");
    if (!panel) return;

    const previous = Playbook.#listeners.get(panel);
    previous?.abort();

    const controller = new AbortController();
    Playbook.#listeners.set(panel, controller);

    panel.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const nav = target.closest("[data-playbook-nav]");
        if (nav) {
          const direction = nav.getAttribute("data-playbook-nav");
          if (direction === "prev") Playbook.prev();
          else if (direction === "next") Playbook.next();
          return;
        }

        const chip = target.closest("[data-playbook-entity]");
        if (!chip) return;
        const uuid = chip.getAttribute("data-playbook-entity");
        if (!uuid) return;

        const entity = EntityRegistry.findByUUID(uuid);
        if (!entity || !Navigation.canNavigate(entity)) return;
        void Navigation.navigate(entity);
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {PlaybookRelatedRef[]} refs
   * @returns {ResolvedRelated[]}
   */
  static #resolveRelated(refs) {
    /** @type {ResolvedRelated[]} */
    const resolved = [];

    for (const ref of refs) {
      if (!ref?.name) continue;

      const result = EntityRegistry.findByName(ref.name, ref.kind);

      if (result.status === "ok") {
        const entity = result.entity;
        const navigable = Navigation.canNavigate(entity);
        resolved.push({
          name: entity.name,
          navigable,
          uuid: navigable ? entity.uuid : undefined,
          hint: navigable ? undefined : "Cannot navigate"
        });
        continue;
      }

      if (result.status === "ambiguous") {
        resolved.push({
          name: ref.name,
          navigable: false,
          hint: "Ambiguous name — not linked"
        });
        continue;
      }

      resolved.push({
        name: ref.name,
        navigable: false,
        hint: "Not found in this world"
      });
    }

    return resolved;
  }
}
