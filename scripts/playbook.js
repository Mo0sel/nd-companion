import { EntityRegistry } from "./entity-registry.js";
import { Navigation } from "./navigation.js";
import { PlaybookEntities } from "./playbook-entities.js";
import { PlaybookService } from "./playbook-service.js";

/**
 * @typedef {import("./playbook-service.js").PlaybookBeat} PlaybookBeat
 */

/**
 * Display-only beat status derived from position vs currentIndex.
 * Not persisted — previous → done, current → active, future → planned.
 * @typedef {"planned"|"active"|"done"} DerivedBeatStatus
 */

/**
 * Play workspace Playbook viewer. Data comes only from PlaybookService.
 */
export class Playbook {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {number} index
   * @param {number} currentIndex
   * @returns {DerivedBeatStatus}
   */
  static #derivedStatus(index, currentIndex) {
    if (index < currentIndex) return "done";
    if (index === currentIndex) return "active";
    return "planned";
  }

  /**
   * @returns {{
   *   index: number,
   *   total: number,
   *   canPrev: boolean,
   *   canNext: boolean,
   *   beat: PlaybookBeat,
   *   nextBeat: PlaybookBeat|null,
   *   status: DerivedBeatStatus,
   *   donePercent: number
   * }}
   */
  static get() {
    const current = PlaybookService.getCurrent();
    const nextBeat =
      current.index < current.total - 1 ? PlaybookService.getBeat(current.index + 1) : null;
    const donePercent = current.total
      ? Math.round((current.index / current.total) * 100)
      : 0;

    return {
      index: current.index,
      total: current.total,
      canPrev: current.canPrevious,
      canNext: current.canNext,
      beat: current.beat,
      nextBeat,
      status: current.total > 0 ? Playbook.#derivedStatus(current.index, current.index) : "planned",
      donePercent
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

    const setCounter = (current, total) => {
      const currentEl = panel.querySelector("[data-playbook-counter=\"current\"]");
      const totalEl = panel.querySelector("[data-playbook-counter=\"total\"]");
      if (currentEl) currentEl.textContent = String(current);
      if (totalEl) totalEl.textContent = String(total);
    };

    const setTextField = (key, value) => {
      const field = panel.querySelector(`[data-playbook-field-block="${key}"]`);
      const text = value?.trim() ?? "";
      if (field) field.hidden = !text;
      setText(key, text);
    };

    const status = snapshot.status;
    panel.dataset.beatStatus = status;
    const accent = panel.querySelector("[data-playbook=\"accent\"]");
    if (accent) accent.dataset.status = status;

    if (snapshot.total <= 0) {
      setCounter(0, 0);
      setText("title", "No beats");
      setTextField("objective", "");
      setTextField("gmNotes", "");
      Playbook.#paintEntities(panel, []);
    } else {
      setCounter(snapshot.index + 1, snapshot.total);
      setText("title", snapshot.beat.title?.trim() || "Untitled Beat");
      setTextField("objective", snapshot.beat.objective);
      setTextField("gmNotes", snapshot.beat.gmNotes);

      const entityUuids = [
        ...(snapshot.beat.sceneUuid ? [snapshot.beat.sceneUuid] : []),
        ...(snapshot.beat.keyNpcUuids ?? [])
      ];
      Playbook.#paintEntities(panel, entityUuids);
    }

    panel.querySelectorAll("[data-playbook-status]").forEach((el) => {
      const value = el.getAttribute("data-playbook-status");
      const active = snapshot.total > 0 && value === status;
      el.setAttribute("aria-pressed", active ? "true" : "false");
      el.classList.toggle("is-active", active);
    });

    const panels = panel.querySelector(".nd-playbook-card__panels");
    if (panels) {
      const visible = [...panels.querySelectorAll(".nd-playbook-panel")].filter((el) => !el.hidden);
      panels.classList.toggle("nd-playbook-card__panels--single", visible.length <= 1);
    }

    const prevBtn = panel.querySelector("[data-playbook-nav=\"prev\"]");
    const nextBtn = panel.querySelector("[data-playbook-nav=\"next\"]");
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = !snapshot.canPrev;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = !snapshot.canNext;

    Playbook.#paintBeatFocus(root, snapshot);
    Playbook.#paintSessionNpcs(root, snapshot);
  }

  /**
   * @param {HTMLElement} panel
   * @param {string[]} uuids
   */
  static #paintEntities(panel, uuids) {
    const field = panel.querySelector("[data-playbook-field-block=\"entities\"]");
    const container = panel.querySelector("[data-playbook=\"entities\"]");
    if (!field || !container) return;

    PlaybookEntities.paintChips(container, uuids);
    field.hidden = uuids.length === 0;
  }

  /**
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #paintBeatFocus(root, snapshot) {
    const focus = root.querySelector("[data-beat-focus]");
    if (!focus) return;

    const set = (key, value, { hideEmpty = false } = {}) => {
      const el = focus.querySelector(`[data-beat-focus="${key}"]`);
      if (!el) return;
      const text = value?.trim?.() ? value.trim() : value || "";
      el.textContent = text || (key.endsWith("title") ? "—" : "");
      if (hideEmpty) el.hidden = !text;
    };

    if (snapshot.total <= 0) {
      set("now-title", "—");
      set("now-objective", "", { hideEmpty: true });
      set("next-title", "—");
      set("next-objective", "", { hideEmpty: true });
    } else {
      set("now-title", snapshot.beat.title?.trim() || "Untitled Beat");
      set("now-objective", snapshot.beat.objective ?? "", { hideEmpty: true });
      set("next-title", snapshot.nextBeat?.title?.trim() || "—");
      set(
        "next-objective",
        snapshot.nextBeat ? snapshot.nextBeat.objective ?? "" : "",
        { hideEmpty: true }
      );
    }

    const pctEl = focus.querySelector("[data-beat-focus=\"done-pct\"]");
    if (pctEl) pctEl.textContent = String(snapshot.donePercent);

    const bar = focus.querySelector("[data-beat-focus=\"done-bar\"]");
    if (bar instanceof HTMLElement) bar.style.width = `${snapshot.donePercent}%`;
  }

  /**
   * Session NPCs from the current beat's characters (EntityRegistry).
   * @param {HTMLElement} root
   * @param {ReturnType<typeof Playbook.get>} snapshot
   */
  static #paintSessionNpcs(root, snapshot) {
    const list = root.querySelector("[data-play-npcs]");
    const empty = root.querySelector("[data-play-npcs-empty]");
    if (!list) return;

    list.replaceChildren();
    const uuids = snapshot.total > 0 ? snapshot.beat.keyNpcUuids ?? [] : [];
    const chips = PlaybookEntities.resolveChips(uuids);

    if (empty) empty.hidden = chips.length > 0;

    for (const chip of chips) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "nd-play-npc";
      if (chip.navigable && !chip.missing) {
        row.classList.add("nd-play-npc--navigable");
        row.dataset.playbookEntity = chip.uuid;
        row.title = `Open ${chip.name} in Foundry`;
      } else {
        row.disabled = true;
        row.title = chip.missing ? "Not found in this world" : "Cannot navigate";
      }

      const avatar = document.createElement("span");
      avatar.className = "nd-play-npc__avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = Playbook.#initials(chip.name);
      avatar.style.setProperty("--nd-npc-avatar", Playbook.#avatarColor(chip.name));

      const meta = document.createElement("span");
      meta.className = "nd-play-npc__meta";

      const name = document.createElement("span");
      name.className = "nd-play-npc__name";
      name.textContent = chip.name;

      if (chip.context) {
        const role = document.createElement("span");
        role.className = "nd-play-npc__role";
        role.textContent = chip.context;
        name.append(role);
      }

      meta.append(name);
      row.append(avatar, meta);
      list.append(row);
    }
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static #initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static #avatarColor(name) {
    const palette = ["#3d5a8a", "#3d6b5a", "#6b4a7a", "#7a5a3d", "#3d6b7a", "#7a3d4a"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length];
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

    const playRoot = root.querySelector("[data-workspace-panel=\"play\"]") ?? panel;

    playRoot.addEventListener(
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
}
