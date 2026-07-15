import { CompanionStorage } from "./storage.js";

const DEBOUNCE_MS = 500;
const SAVED_VISIBLE_MS = 1000;

/**
 * Click-to-edit, autosaving note regions driven by storage keys.
 */
export class LiveNotes {
  /**
   * Load persisted text and attach autosave behavior to a contenteditable element.
   * Safe to call again when the storage key changes (replaces prior listeners).
   *
   * @param {HTMLElement} element
   * @param {string} key Storage key (e.g. "currentBeat" or "actor:Actor.xxx")
   * @param {{ memory?: boolean }} [options]
   */
  static attach(element, key, options = {}) {
    if (!(element instanceof HTMLElement) || !key) return;

    if (typeof element._ndLiveNotesCleanup === "function") {
      element._ndLiveNotesCleanup();
      element._ndLiveNotesCleanup = null;
    }

    const useMemory = Boolean(options.memory);
    const read = (k) => (useMemory ? CompanionStorage.getMemory(k) : CompanionStorage.get(k));
    const write = (k, v) => (useMemory ? CompanionStorage.setMemory(k, v) : CompanionStorage.set(k, v));

    element.setAttribute("contenteditable", "true");
    element.dataset.storage = key;
    element.textContent = read(key);

    let debounceId = null;
    let statusClearId = null;
    const statusEl = element
      .closest("[data-live-notes-root], .nd-card")
      ?.querySelector("[data-live-notes-status]");

    const setStatus = (text) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.hidden = !text;
    };

    const save = async () => {
      const value = element.textContent ?? "";
      setStatus("Saving...");
      await write(key, value);
      setStatus("Saved");
      clearTimeout(statusClearId);
      statusClearId = setTimeout(() => setStatus(""), SAVED_VISIBLE_MS);
    };

    const onInput = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        save().catch((err) => {
          console.error("N&D Companion: failed to save live note", key, err);
          setStatus("");
        });
      }, DEBOUNCE_MS);
    };

    element.addEventListener("input", onInput);

    element._ndLiveNotesCleanup = () => {
      clearTimeout(debounceId);
      clearTimeout(statusClearId);
      element.removeEventListener("input", onInput);
      setStatus("");
    };
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
