/**
 * Reusable bottom-edge panel resizing.
 * Heights are local UI preferences, scoped by world and panel key.
 */
export class PanelResizer {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement} root
   */
  static attach(root) {
    if (!(root instanceof HTMLElement)) return;
    root.querySelectorAll("[data-resizable-panel]").forEach((panel) => {
      if (panel instanceof HTMLElement) PanelResizer.#attachPanel(panel);
    });
  }

  /**
   * @param {HTMLElement} panel
   */
  static #attachPanel(panel) {
    PanelResizer.#listeners.get(panel)?.abort();
    const controller = new AbortController();
    PanelResizer.#listeners.set(panel, controller);

    const key = panel.dataset.resizablePanel;
    if (!key) return;

    panel.classList.add("nd-resizable-panel");
    let handle = panel.querySelector(":scope > .nd-resize-handle");
    if (!(handle instanceof HTMLElement)) {
      handle = document.createElement("div");
      handle.className = "nd-resize-handle";
      handle.setAttribute("aria-hidden", "true");
      panel.append(handle);
    }

    const stored = PanelResizer.#read(key);
    if (stored) panel.style.height = `${stored}px`;

    handle.addEventListener(
      "pointerdown",
      (event) => {
        if (!(event instanceof PointerEvent) || event.button !== 0) return;
        event.preventDefault();

        const startY = event.clientY;
        const startHeight = panel.getBoundingClientRect().height;
        const min = Number(panel.dataset.resizeMin) || 64;
        const configuredMax = Number(panel.dataset.resizeMax);
        const max = Number.isFinite(configuredMax) && configuredMax > min
          ? configuredMax
          : Math.max(min, window.innerHeight - 100);

        const onMove = (moveEvent) => {
          const height = Math.round(
            Math.min(max, Math.max(min, startHeight + moveEvent.clientY - startY))
          );
          panel.style.height = `${height}px`;
        };
        const onEnd = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onEnd);
          window.removeEventListener("pointercancel", onEnd);
          PanelResizer.#write(key, Math.round(panel.getBoundingClientRect().height));
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd, { once: true });
        window.addEventListener("pointercancel", onEnd, { once: true });
      },
      { signal: controller.signal }
    );

    handle.addEventListener(
      "dblclick",
      () => {
        panel.style.removeProperty("height");
        PanelResizer.#remove(key);
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  static #storageKey(key) {
    const worldId = game.world?.id ?? "world";
    return `nd-companion:panel-height:${worldId}:${key}`;
  }

  /**
   * @param {string} key
   * @returns {number|null}
   */
  static #read(key) {
    try {
      const value = Number(localStorage.getItem(PanelResizer.#storageKey(key)));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} key
   * @param {number} height
   */
  static #write(key, height) {
    try {
      localStorage.setItem(PanelResizer.#storageKey(key), String(height));
    } catch {
      // Local preferences are optional; resizing still works for this render.
    }
  }

  /**
   * @param {string} key
   */
  static #remove(key) {
    try {
      localStorage.removeItem(PanelResizer.#storageKey(key));
    } catch {
      // Ignore unavailable local storage.
    }
  }
}
