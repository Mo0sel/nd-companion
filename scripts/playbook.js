import { EntityRegistry } from "./entity-registry.js";
import { Navigation } from "./navigation.js";
import { PlaybookEntities } from "./playbook-entities.js";
import { PlaybookService } from "./playbook-service.js";

/**
 * @typedef {import("./playbook-service.js").PlaybookBeat} PlaybookBeat
 */

/**
 * @typedef {object} ResolvedRelated
 * @property {string} name
 * @property {boolean} navigable
 * @property {string} [uuid]
 * @property {string} [hint]
 */

/**
 * Notes workspace Playbook viewer. Data comes only from PlaybookService.
 */
export class Playbook {
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
    const current = PlaybookService.getCurrent();
    return {
      index: current.index,
      total: current.total,
      canPrev: current.canPrevious,
      canNext: current.canNext,
      beat: current.beat,
      related: Playbook.#resolveRelated(current.beat.related ?? [])
    };
  }

  static async prev() {
    const moved = await PlaybookService.previous();
    if (moved) Playbook.refreshOpen();
  }

  static async next() {
    const moved = await PlaybookService.next();
    if (moved) Playbook.refreshOpen();
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

    const setTextField = (key, value) => {
      const field = panel.querySelector(`[data-playbook-field-block="${key}"]`);
      const text = value?.trim() ?? "";
      if (field) field.hidden = !text;
      setText(key, text);
    };

    if (snapshot.total <= 0) {
      setText("counter", "0 / 0");
      setText("title", "No beats");
      setTextField("objective", "");
      setTextField("gmNotes", "");
      Playbook.#paintEntityBlock(panel, "scene", []);
      Playbook.#paintEntityBlock(panel, "characters", []);
    } else {
      setText("counter", `${snapshot.index + 1} / ${snapshot.total}`);
      setText("title", snapshot.beat.title?.trim() || "Untitled Beat");
      setTextField("objective", snapshot.beat.objective);
      setTextField("gmNotes", snapshot.beat.gmNotes);

      const sceneUuids = snapshot.beat.sceneUuid ? [snapshot.beat.sceneUuid] : [];
      Playbook.#paintEntityBlock(panel, "scene", sceneUuids);
      Playbook.#paintEntityBlock(panel, "characters", snapshot.beat.keyNpcUuids ?? []);
    }

    const prevBtn = panel.querySelector("[data-playbook-nav=\"prev\"]");
    const nextBtn = panel.querySelector("[data-playbook-nav=\"next\"]");
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = !snapshot.canPrev;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = !snapshot.canNext;

    // related[] reserved for future relationship system — do not paint
    const relatedRoot = panel.querySelector("[data-playbook=\"related\"]");
    const relatedSection = panel.querySelector("[data-playbook-related]");
    if (relatedRoot) relatedRoot.replaceChildren();
    if (relatedSection) relatedSection.hidden = true;
  }

  /**
   * @param {HTMLElement} panel
   * @param {"scene"|"characters"} key
   * @param {string[]} uuids
   */
  static #paintEntityBlock(panel, key, uuids) {
    const field = panel.querySelector(`[data-playbook-field-block="${key}"]`);
    const container = panel.querySelector(`[data-playbook="${key}"]`);
    if (!field || !container) return;

    PlaybookEntities.paintChips(container, uuids);
    field.hidden = uuids.length === 0;
  }

  /**
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
          if (direction === "prev") void Playbook.prev();
          else if (direction === "next") void Playbook.next();
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
   * Kept for future relationship system — related[] is not painted.
   * @param {import("./playbook-service.js").PlaybookRelatedRef[]} refs
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
