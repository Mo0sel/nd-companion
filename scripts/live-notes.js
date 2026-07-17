import { CompanionStorage } from "./storage.js";

const DEBOUNCE_MS = 500;
const SAVED_VISIBLE_MS = 1000;

/**
 * Click-to-edit, autosaving regions.
 * Supports CompanionStorage keys or custom load/save callbacks (same debounce + status UX).
 */
export class LiveNotes {
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
    const statusEl = element
      .closest("[data-live-notes-root], .nd-card")
      ?.querySelector("[data-live-notes-status]");

    const setStatus = (text) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.hidden = !text;
    };

    const save = async () => {
      const raw = useHtml ? element.innerHTML : element.textContent ?? "";
      const value = useHtml ? sanitize(raw) : raw;
      setStatus("Saving...");
      await write(value);
      setStatus("Saved");
      clearTimeout(statusClearId);
      statusClearId = setTimeout(() => setStatus(""), SAVED_VISIBLE_MS);
    };

    const onInput = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        save().catch((err) => {
          console.error("N&D Companion: failed to save live note", key ?? "callback", err);
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
