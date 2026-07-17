import { EntityRegistry } from "./entity-registry.js";
import { LiveNotes } from "./live-notes.js";
import { Navigation } from "./navigation.js";
import { Playbook } from "./playbook.js";
import { PlaybookEntities } from "./playbook-entities.js";
import { PlaybookService } from "./playbook-service.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";

const PREPARE_FIELDS = /** @type {const} */ (["title", "objective", "gmNotes"]);
const RICH_TEXT_FIELDS = new Set(["objective", "gmNotes"]);

/**
 * Prepare workspace Playbook authoring.
 * editIndex is UI-only; Viewer currentIndex is separate.
 */
export class PlaybookPrepare {
  /** @type {number|null} UI-only selection; independent of Viewer currentIndex */
  static #editIndex = null;

  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement} root
   * @param {{ focusTitle?: boolean, scrollToEdit?: boolean }} [options]
   */
  static paint(root, options = {}) {
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector("[data-playbook-prepare]");
    if (!panel) return;

    const total = PlaybookService.getTotal();
    if (total <= 0) {
      PlaybookPrepare.#editIndex = null;
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
    PlaybookPrepare.#paintEntityPickers(panel);

    if (options.scrollToEdit) {
      PlaybookPrepare.#scrollEditIntoView(panel);
    }
    if (options.focusTitle) {
      requestAnimationFrame(() => PlaybookPrepare.#focusTitle(panel));
    }
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

        const addBtn = target.closest("[data-playbook-add-beat]");
        if (addBtn) {
          void PlaybookPrepare.#onAddBeat(root);
          return;
        }

        const deleteBtn = target.closest("[data-playbook-delete-beat]");
        if (deleteBtn) {
          event.preventDefault();
          event.stopPropagation();
          const index = Number(deleteBtn.getAttribute("data-playbook-delete-beat"));
          if (Number.isInteger(index)) void PlaybookPrepare.#onDeleteBeat(root, index);
          return;
        }

        const removeEntity = target.closest("[data-playbook-remove-entity]");
        if (removeEntity) {
          event.preventDefault();
          event.stopPropagation();
          const uuid = removeEntity.getAttribute("data-playbook-remove-entity");
          if (uuid) void PlaybookPrepare.#onRemoveCharacter(root, uuid);
          return;
        }

        const entityChip = target.closest("[data-playbook-entity]");
        if (entityChip) {
          const uuid = entityChip.getAttribute("data-playbook-entity");
          if (uuid) {
            const entity = EntityRegistry.findByUUID(uuid);
            if (entity && Navigation.canNavigate(entity)) void Navigation.navigate(entity);
          }
          return;
        }

        const addCharacter = target.closest("[data-playbook-add-character]");
        if (addCharacter) {
          void PlaybookPrepare.#onAddCharacter(root, panel);
          return;
        }

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
          if (PlaybookPrepare.#editIndex === null) return;
          void PlaybookService.setCurrentIndex(PlaybookPrepare.#editIndex).then(() => {
            PlaybookPrepare.paint(root);
            Playbook.refreshOpen();
          });
        }
      },
      { signal: controller.signal }
    );

    panel.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.matches("[data-playbook-scene-select]")) {
          void PlaybookPrepare.#onSceneChange(root, target.value);
        }
      },
      { signal: controller.signal }
    );

    RichTextToolbar.attach(panel);
  }

  /**
   * @param {HTMLElement} root
   */
  static async #onAddBeat(root) {
    const index = await PlaybookService.addBeat();
    PlaybookPrepare.#editIndex = index;
    PlaybookPrepare.paint(root, { focusTitle: true, scrollToEdit: true });
    Playbook.refreshOpen();
  }

  /**
   * @param {HTMLElement} root
   * @param {number} index
   */
  static async #onDeleteBeat(root, index) {
    const beat = PlaybookService.getBeat(index);
    const label = beat?.title?.trim() || "Untitled Beat";

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Beat" },
      content: `<p>Delete beat <strong>${foundry.utils.escapeHTML(label)}</strong>?</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed !== true) return;

    const result = await PlaybookService.deleteBeat(index);
    if (!result.ok) return;

    PlaybookPrepare.#editIndex = result.nextEditIndex;
    PlaybookPrepare.paint(root);
    Playbook.refreshOpen();
  }

  /**
   * @param {HTMLElement} root
   * @param {string} value
   */
  static async #onSceneChange(root, value) {
    if (PlaybookPrepare.#editIndex === null) return;
    await PlaybookService.updateBeat(PlaybookPrepare.#editIndex, {
      sceneUuid: value || null
    });
    PlaybookPrepare.paint(root);
    if (PlaybookPrepare.#editIndex === PlaybookService.getIndex()) {
      Playbook.refreshOpen();
    }
  }

  /**
   * @param {HTMLElement} root
   * @param {HTMLElement} panel
   */
  static async #onAddCharacter(root, panel) {
    if (PlaybookPrepare.#editIndex === null) return;
    const select = panel.querySelector("[data-playbook-character-select]");
    if (!(select instanceof HTMLSelectElement) || !select.value) return;

    const beat = PlaybookService.getBeat(PlaybookPrepare.#editIndex);
    if (!beat) return;

    const uuid = select.value;
    if (beat.keyNpcUuids.includes(uuid)) {
      select.value = "";
      return;
    }

    await PlaybookService.updateBeat(PlaybookPrepare.#editIndex, {
      keyNpcUuids: [...beat.keyNpcUuids, uuid]
    });
    PlaybookPrepare.paint(root);
    if (PlaybookPrepare.#editIndex === PlaybookService.getIndex()) {
      Playbook.refreshOpen();
    }
  }

  /**
   * @param {HTMLElement} root
   * @param {string} uuid
   */
  static async #onRemoveCharacter(root, uuid) {
    if (PlaybookPrepare.#editIndex === null) return;
    const beat = PlaybookService.getBeat(PlaybookPrepare.#editIndex);
    if (!beat) return;

    await PlaybookService.updateBeat(PlaybookPrepare.#editIndex, {
      keyNpcUuids: beat.keyNpcUuids.filter((id) => id !== uuid)
    });
    PlaybookPrepare.paint(root);
    if (PlaybookPrepare.#editIndex === PlaybookService.getIndex()) {
      Playbook.refreshOpen();
    }
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
      const row = document.createElement("div");
      row.className = "nd-playbook-prepare__row";
      if (beat.index === PlaybookPrepare.#editIndex) row.classList.add("is-selected");
      if (beat.isCurrent) row.classList.add("is-current");

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "nd-playbook-prepare__beat";
      selectBtn.dataset.playbookEditIndex = String(beat.index);
      selectBtn.setAttribute(
        "aria-pressed",
        beat.index === PlaybookPrepare.#editIndex ? "true" : "false"
      );
      selectBtn.textContent = `${beat.index + 1}. ${beat.title}`;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "nd-playbook-prepare__delete";
      deleteBtn.dataset.playbookDeleteBeat = String(beat.index);
      deleteBtn.setAttribute("aria-label", `Delete ${beat.title}`);
      deleteBtn.textContent = "×";

      row.append(selectBtn, deleteBtn);
      list.append(row);
    }
  }

  /**
   * @param {HTMLElement} panel
   */
  static #paintEditor(panel) {
    const empty = panel.querySelector("[data-playbook-prepare-empty]");
    const editor = panel.querySelector("[data-playbook-prepare-editor]");
    if (!empty || !editor) return;

    const beat =
      PlaybookPrepare.#editIndex === null
        ? null
        : PlaybookService.getBeat(PlaybookPrepare.#editIndex);

    if (!beat) {
      empty.hidden = false;
      editor.hidden = true;
      for (const field of PREPARE_FIELDS) {
        const el = editor.querySelector(`[data-playbook-field="${field}"]`);
        if (el) {
          LiveNotes.detach(el);
          if (RICH_TEXT_FIELDS.has(field)) el.innerHTML = "";
          else el.textContent = "";
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
      total > 0 &&
      PlaybookPrepare.#editIndex !== null &&
      PlaybookPrepare.#editIndex === PlaybookService.getIndex();

    button.disabled = total <= 0 || PlaybookPrepare.#editIndex === null || isCurrent;
    button.textContent = isCurrent ? "Current Beat" : "Set as Current Beat";
  }

  /**
   * @param {HTMLElement} panel
   */
  static #paintEntityPickers(panel) {
    const editor = panel.querySelector("[data-playbook-prepare-editor]");
    if (!editor || editor.hidden || PlaybookPrepare.#editIndex === null) return;

    const beat = PlaybookService.getBeat(PlaybookPrepare.#editIndex);
    if (!beat) return;

    const sceneSelect = panel.querySelector("[data-playbook-scene-select]");
    if (sceneSelect instanceof HTMLSelectElement) {
      PlaybookPrepare.#fillSelect(sceneSelect, "scene", beat.sceneUuid, false);
    }

    const sceneChips = panel.querySelector("[data-playbook-scene-chips]");
    if (sceneChips) {
      PlaybookEntities.paintSceneChip(sceneChips, beat.sceneUuid);
    }

    const characterSelect = panel.querySelector("[data-playbook-character-select]");
    if (characterSelect instanceof HTMLSelectElement) {
      const selected = new Set(beat.keyNpcUuids);
      PlaybookPrepare.#fillSelect(characterSelect, "actor", null, true, selected);
    }

    const characterChips = panel.querySelector("[data-playbook-character-chips]");
    if (characterChips) {
      PlaybookEntities.paintChips(characterChips, beat.keyNpcUuids, { removable: true });
    }
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {"actor"|"scene"} kind
   * @param {string|null} selectedUuid
   * @param {boolean} includePlaceholder
   * @param {Set<string>} [exclude]
   */
  static #fillSelect(select, kind, selectedUuid, includePlaceholder, exclude = new Set()) {
    const previous = select.value;
    select.replaceChildren();

    if (includePlaceholder || kind === "scene") {
      const none = document.createElement("option");
      none.value = "";
      none.textContent = kind === "scene" ? "None" : "Add character…";
      select.append(none);
    }

    for (const entity of PlaybookEntities.choices(kind)) {
      if (exclude.has(entity.uuid)) continue;
      const option = document.createElement("option");
      option.value = entity.uuid;
      option.textContent = PlaybookEntities.choiceLabel(entity);
      select.append(option);
    }

    if (selectedUuid && [...select.options].some((o) => o.value === selectedUuid)) {
      select.value = selectedUuid;
    } else if (!includePlaceholder && previous && [...select.options].some((o) => o.value === previous)) {
      select.value = previous;
    } else {
      select.value = "";
    }
  }

  /**
   * @param {HTMLElement} panel
   */
  static #attachFields(panel) {
    const editor = panel.querySelector("[data-playbook-prepare-editor]");
    if (!editor || editor.hidden) return;

    const editIndex = PlaybookPrepare.#editIndex;
    if (editIndex === null) return;

    for (const field of PREPARE_FIELDS) {
      const el = editor.querySelector(`[data-playbook-field="${field}"]`);
      if (!(el instanceof HTMLElement)) continue;

      const richText = RICH_TEXT_FIELDS.has(field);
      LiveNotes.attach(el, null, {
        html: richText,
        sanitize: richText ? RichText.sanitize : undefined,
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

  /**
   * @param {HTMLElement} panel
   */
  static #scrollEditIntoView(panel) {
    if (PlaybookPrepare.#editIndex === null) return;
    const row = panel.querySelector(
      `[data-playbook-edit-index="${PlaybookPrepare.#editIndex}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }

  /**
   * @param {HTMLElement} panel
   */
  static #focusTitle(panel) {
    const title = panel.querySelector('[data-playbook-field="title"]');
    if (!(title instanceof HTMLElement) || title.closest("[hidden]")) return;
    title.focus();
  }
}
