import { CompanionStorage } from "./storage.js";

const DEBOUNCE_MS = 500;
const SAVED_VISIBLE_MS = 1000;

/**
 * Click-to-edit, autosaving regions.
 * Supports CompanionStorage keys or custom load/save callbacks (same debounce + status UX).
 */
export class LiveNotes {
  /** @type {WeakMap<HTMLElement, { flush: () => Promise<void> }>} */
  static #states = new WeakMap();

  /**
   * Load content and attach autosave behavior to a contenteditable element.
   * Safe to call again when the binding changes (replaces prior listeners).
   *
   * Storage-key mode:
   *   LiveNotes.attach(el, "sessionNotes")
   *   LiveNotes.attach(el, "actor:…", { memory: true })
   *
   * Callback mode (no storage key required):
   *   LiveNotes.attach(el, null, { load: () => "…", save: async (v) => { … } })
   *
   * @param {HTMLElement} element
   * @param {string|null} key Storage key, or null in callback mode
   * @param {{
   *   memory?: boolean,
   *   html?: boolean,
   *   sanitize?: (value: string) => string,
   *   load?: () => string,
   *   save?: (value: string) => Promise<unknown>|unknown
   * }} [options]
   */
  static attach(element, key, options = {}) {
    if (!(element instanceof HTMLElement)) return;

    const callbackMode =
      typeof options.load === "function" && typeof options.save === "function";
    if (!callbackMode && !key) return;

    if (typeof element._ndLiveNotesCleanup === "function") {
      element._ndLiveNotesCleanup();
      element._ndLiveNotesCleanup = null;
    }

    const useMemory = Boolean(options.memory);
    const useHtml = Boolean(options.html);
    const sanitize = typeof options.sanitize === "function"
      ? options.sanitize
      : (value) => value;
    const read = () => {
      if (callbackMode) return options.load() ?? "";
      return useMemory ? CompanionStorage.getMemory(key) : CompanionStorage.get(key);
    };
    const write = (value) => {
      if (callbackMode) return options.save(value);
      return useMemory ? CompanionStorage.setMemory(key, value) : CompanionStorage.set(key, value);
    };

    element.setAttribute("contenteditable", "true");
    if (key) element.dataset.storage = key;
    else delete element.dataset.storage;
    const initial = String(read() ?? "");
    if (useHtml) element.innerHTML = sanitize(initial);
    else element.textContent = initial;

    let debounceId = null;
    let statusClearId = null;
    let retryId = null;
    let dirty = false;
    let saving = null;
    let revision = 0;
    const statusEl = element
      .closest("[data-live-notes-root], .nd-card")
      ?.querySelector("[data-live-notes-status]");

    const setStatus = (text) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.hidden = !text;
    };

    const save = async () => {
      if (saving) {
        await saving.catch(() => {});
        if (dirty) return save();
        return;
      }
      const raw = useHtml ? element.innerHTML : element.textContent ?? "";
      const value = useHtml ? sanitize(raw) : raw;
      const savingRevision = revision;
      setStatus("Saving...");
      saving = Promise.resolve(write(value))
        .then(() => {
          dirty = revision !== savingRevision;
          clearTimeout(retryId);
          if (dirty) {
            retryId = setTimeout(() => {
              retryId = null;
              void save();
            }, 0);
          } else {
            setStatus("Saved");
            clearTimeout(statusClearId);
            statusClearId = setTimeout(() => setStatus(""), SAVED_VISIBLE_MS);
          }
        })
        .catch((err) => {
          console.error("N&D Companion: failed to save live note", key ?? "callback", err);
          dirty = true;
          setStatus("Unsaved changes");
          clearTimeout(retryId);
          retryId = setTimeout(() => {
            retryId = null;
            void save();
          }, 1500);
          throw err;
        })
        .finally(() => {
          saving = null;
        });
      return saving;
    };

    const onInput = () => {
      revision += 1;
      dirty = true;
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        void save().catch(() => {});
      }, DEBOUNCE_MS);
    };

    const onBlur = () => {
      if (debounceId === null) return;
      clearTimeout(debounceId);
      debounceId = null;
      void save().catch(() => {});
    };

    element.addEventListener("input", onInput);
    element.addEventListener("blur", onBlur);
    const flush = async () => {
      if (debounceId !== null) {
        clearTimeout(debounceId);
        debounceId = null;
      }
      if (!dirty) {
        if (saving) await saving;
        return;
      }
      await save();
    };
    LiveNotes.#states.set(element, { flush });

    element._ndLiveNotesCleanup = () => {
      clearTimeout(debounceId);
      clearTimeout(statusClearId);
      clearTimeout(retryId);
      element.removeEventListener("input", onInput);
      element.removeEventListener("blur", onBlur);
      LiveNotes.#states.delete(element);
      setStatus("");
    };
  }

  /** @param {HTMLElement} element */
  static async flush(element) {
    const state = LiveNotes.#states.get(element);
    if (state) await state.flush();
  }

  /** @param {HTMLElement} root */
  static async flushAll(root) {
    if (!(root instanceof HTMLElement)) return;
    const elements = [
      ...(LiveNotes.#states.has(root) ? [root] : []),
      ...root.querySelectorAll("[contenteditable=\"true\"]")
    ].filter((element) => element instanceof HTMLElement && LiveNotes.#states.has(element));
    await Promise.all(elements.map((element) => LiveNotes.flush(element)));
  }

  /**
   * Detach autosave behavior from an element.
   * @param {HTMLElement} element
   */
  static detach(element) {
    if (!(element instanceof HTMLElement)) return;
    if (typeof element._ndLiveNotesCleanup === "function") {
      element._ndLiveNotesCleanup();
      element._ndLiveNotesCleanup = null;
    }
    element.removeAttribute("contenteditable");
    delete element.dataset.storage;
  }
}
