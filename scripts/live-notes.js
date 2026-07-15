import { CompanionStorage } from "./storage.js";

const DEBOUNCE_MS = 500;
const SAVED_VISIBLE_MS = 1000;

/**
 * Click-to-edit, autosaving note regions driven by data-storage keys.
 */
export class LiveNotes {
  /**
   * Load persisted text and attach autosave behavior to a contenteditable element.
   * @param {HTMLElement} element
   * @param {string} key Storage key (e.g. "currentBeat")
   */
  static attach(element, key) {
    if (!(element instanceof HTMLElement) || !key) return;

    element.setAttribute("contenteditable", "true");
    element.dataset.storage = key;

    const saved = CompanionStorage.get(key);
    element.textContent = saved;

    let debounceId = null;
    let statusClearId = null;
    const statusEl = element
      .closest(".nd-card")
      ?.querySelector("[data-live-notes-status]");

    const setStatus = (text) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.hidden = !text;
    };

    const save = async () => {
      const value = element.textContent ?? "";
      setStatus("Saving...");
      await CompanionStorage.set(key, value);
      setStatus("Saved");
      clearTimeout(statusClearId);
      statusClearId = setTimeout(() => setStatus(""), SAVED_VISIBLE_MS);
    };

    element.addEventListener("input", () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        save().catch((err) => {
          console.error("N&D Companion: failed to save live note", key, err);
          setStatus("");
        });
      }, DEBOUNCE_MS);
    });
  }
}
