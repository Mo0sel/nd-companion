import { RichText } from "./rich-text.js";

/**
 * One lightweight toolbar shared by Objective and GM Notes.
 * It remembers the last Selection/Range inside either editor.
 */
export class RichTextToolbar {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement} root
   */
  static attach(root) {
    if (!(root instanceof HTMLElement)) return;
    const toolbar = root.querySelector("[data-richtext-toolbar]");
    if (!(toolbar instanceof HTMLElement)) return;

    RichTextToolbar.#listeners.get(toolbar)?.abort();
    const controller = new AbortController();
    RichTextToolbar.#listeners.set(toolbar, controller);

    /** @type {HTMLElement|null} */
    let activeEditor = null;
    /** @type {Range|null} */
    let savedRange = null;

    const editors = [...root.querySelectorAll("[data-richtext-editor]")].filter(
      (el) => el instanceof HTMLElement
    );

    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!activeEditor || !selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (activeEditor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    };

    const setEnabled = (enabled) => {
      toolbar.querySelectorAll("button, select").forEach((control) => {
        if (control instanceof HTMLButtonElement || control instanceof HTMLSelectElement) {
          control.disabled = !enabled;
        }
      });
    };

    setEnabled(false);

    for (const editor of editors) {
      editor.addEventListener(
        "focus",
        () => {
          activeEditor = editor;
          setEnabled(true);
          rememberSelection();
        },
        { signal: controller.signal }
      );
      editor.addEventListener("keyup", rememberSelection, { signal: controller.signal });
      editor.addEventListener("mouseup", rememberSelection, { signal: controller.signal });
      editor.addEventListener(
        "paste",
        (event) => {
          RichText.paste(editor, event);
          rememberSelection();
        },
        { signal: controller.signal }
      );
    }

    toolbar.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("button[data-richtext-command]")) {
          event.preventDefault();
        }
      },
      { signal: controller.signal }
    );

    toolbar.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("button[data-richtext-command]");
        if (!(button instanceof HTMLButtonElement) || !activeEditor || !savedRange) return;

        const command = button.dataset.richtextCommand;
        const value = button.dataset.richtextValue ?? "";
        if (!command) return;
        savedRange = RichText.apply(activeEditor, savedRange, command, value);
      },
      { signal: controller.signal }
    );

    const colorSelect = toolbar.querySelector("[data-richtext-color]");
    if (colorSelect instanceof HTMLSelectElement) {
      colorSelect.addEventListener(
        "change",
        () => {
          if (!activeEditor || !savedRange) return;
          savedRange = RichText.apply(activeEditor, savedRange, "color", colorSelect.value);
          colorSelect.value = "default";
        },
        { signal: controller.signal }
      );
    }
  }
}
