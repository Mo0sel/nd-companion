import { LiveNotes } from "./live-notes.js";
import { Playbook } from "./playbook.js";
import { PlaybookService } from "./playbook-service.js";

/**
 * Prepare workspace Playbook authoring (MVP).
 * editIndex is UI-only; Viewer currentIndex is separate.
 */
export class PlaybookPrepare {
  /** @type {number|null} UI-only selection; independent of Viewer currentIndex */
  static #editIndex = null;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement} root
   */
  static paint(root) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-playbook-prepare]");
    if (!panel) return;

    const total = PlaybookService.getTotal();
    if (total <= 0) {
      PlaybookPrepare.#editIndex = 0;
    } else if (PlaybookPrepare.#editIndex === null) {
      PlaybookPrepare.#editIndex = PlaybookService.getIndex();
    } else {
      PlaybookPrepare.#editIndex = Math.min(
        Math.max(PlaybookPrepare.#editIndex, 0),
        total - 1
      );
    }

    PlaybookPrepare.#paintList(panel);
    PlaybookPrepare.#paintEditor(panel);
    PlaybookPrepare.#paintCurrentButton(panel);
    PlaybookPrepare.#attachFields(panel);
  }

  /**
   * @param {HTMLElement} root
   */
  static attach(root) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-playbook-prepare]");
    if (!panel) return;

    const previous = PlaybookPrepare.#listeners.get(panel);
    previous?.abort();

    const controller = new AbortController();
    PlaybookPrepare.#listeners.set(panel, controller);

    panel.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const row = target.closest("[data-playbook-edit-index]");
        if (row) {
          const index = Number(row.getAttribute("data-playbook-edit-index"));
          if (!Number.isInteger(index)) return;
          PlaybookPrepare.#editIndex = index;
          PlaybookPrepare.paint(root);
          return;
        }

        const setCurrent = target.closest("[data-playbook-set-current]");
        if (setCurrent) {
          void PlaybookService.setCurrentIndex(PlaybookPrepare.#editIndex).then(() => {
            PlaybookPrepare.paint(root);
            Playbook.refreshOpen();
          });
        }
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {HTMLElement} panel
   */
  static #paintList(panel) {
    const list = panel.querySelector("[data-playbook-prepare-list]");
    if (!list) return;

    const beats = PlaybookService.listBeats();
    list.replaceChildren();

    for (const beat of beats) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nd-playbook-prepare__beat";
      button.dataset.playbookEditIndex = String(beat.index);
      button.setAttribute("aria-pressed", beat.index === PlaybookPrepare.#editIndex ? "true" : "false");
      if (beat.index === PlaybookPrepare.#editIndex) {
        button.classList.add("is-selected");
      }
      if (beat.isCurrent) {
        button.classList.add("is-current");
      }

      const indexEl = document.createElement("span");
      indexEl.className = "nd-playbook-prepare__beat-index";
      indexEl.textContent = String(beat.index + 1);

      const titleEl = document.createElement("span");
      titleEl.className = "nd-playbook-prepare__beat-title";
      titleEl.textContent = beat.title;

      button.append(indexEl, titleEl);
      list.append(button);
    }
  }

  /**
   * @param {HTMLElement} panel
   */
  static #paintEditor(panel) {
    const beat = PlaybookService.getBeat(PlaybookPrepare.#editIndex);
    const empty = panel.querySelector("[data-playbook-prepare-empty]");
    const editor = panel.querySelector("[data-playbook-prepare-editor]");
    if (!empty || !editor) return;

    if (!beat) {
      empty.hidden = false;
      editor.hidden = true;
      for (const field of ["title", "objective", "gmNotes"]) {
        const el = editor.querySelector(`[data-playbook-field="${field}"]`);
        if (el) {
          LiveNotes.detach(el);
          el.textContent = "";
        }
      }
      return;
    }

    empty.hidden = true;
    editor.hidden = false;
  }

  /**
   * @param {HTMLElement} panel
   */
  static #paintCurrentButton(panel) {
    const button = panel.querySelector("[data-playbook-set-current]");
    if (!(button instanceof HTMLButtonElement)) return;

    const total = PlaybookService.getTotal();
    const isCurrent =
      total > 0 && PlaybookPrepare.#editIndex === PlaybookService.getIndex();

    button.disabled = total <= 0 || isCurrent;
    button.textContent = isCurrent ? "Current Beat" : "Set as Current Beat";
  }

  /**
   * @param {HTMLElement} panel
   */
  static #attachFields(panel) {
    const editor = panel.querySelector("[data-playbook-prepare-editor]");
    if (!editor || editor.hidden) return;

    const editIndex = PlaybookPrepare.#editIndex;

    for (const field of /** @type {const} */ (["title", "objective", "gmNotes"])) {
      const el = editor.querySelector(`[data-playbook-field="${field}"]`);
      if (!(el instanceof HTMLElement)) continue;

      LiveNotes.attach(el, null, {
        load: () => PlaybookService.getBeat(editIndex)?.[field] ?? "",
        save: async (value) => {
          await PlaybookService.updateBeat(editIndex, { [field]: value });
          if (field === "title") {
            PlaybookPrepare.#paintList(panel);
            PlaybookPrepare.#paintCurrentButton(panel);
          }
          if (editIndex === PlaybookService.getIndex()) {
            Playbook.refreshOpen();
          }
        }
      });
    }
  }
}
