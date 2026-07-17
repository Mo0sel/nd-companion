import { MentionProvider } from "./mention-provider.js";
import { RichText } from "./rich-text.js";

/**
 * Generic @mention capability for native rich-text editors.
 * Stored mentions are semantic spans; consumers decide how references map.
 */
export class EntityMentions {
  /** @type {WeakMap<HTMLElement, MentionState>} */
  static #states = new WeakMap();

  /**
   * @param {HTMLElement} editor
   */
  static attach(editor) {
    if (!(editor instanceof HTMLElement)) return;
    EntityMentions.detach(editor);

    const controller = new AbortController();
    const popup = document.createElement("div");
    popup.className = "nd-mention-popup";
    popup.hidden = true;
    popup.setAttribute("role", "listbox");
    document.body.append(popup);

    /** @type {MentionState} */
    const state = {
      controller,
      popup,
      entries: [],
      activeIndex: 0,
      replaceRange: null
    };
    EntityMentions.#states.set(editor, state);

    editor.addEventListener("input", () => EntityMentions.#update(editor, state), {
      signal: controller.signal
    });
    editor.addEventListener(
      "keydown",
      (event) => EntityMentions.#onKeyDown(editor, state, event),
      { signal: controller.signal }
    );
    editor.addEventListener("blur", () => {
      setTimeout(() => EntityMentions.#close(state), 0);
    }, { signal: controller.signal });

    popup.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const option = target.closest("[data-mention-option]");
        if (!option) return;
        event.preventDefault();
        const index = Number(option.getAttribute("data-mention-option"));
        if (Number.isInteger(index)) EntityMentions.#insert(editor, state, index);
      },
      { signal: controller.signal }
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (!editor.contains(target) && !popup.contains(target)) EntityMentions.#close(state);
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {HTMLElement} editor
   */
  static detach(editor) {
    const state = EntityMentions.#states.get(editor);
    if (!state) return;
    state.controller.abort();
    state.popup.remove();
    EntityMentions.#states.delete(editor);
  }

  /**
   * Extract unique semantic mentions from sanitized HTML.
   * @param {string} html
   * @returns {MentionReference[]}
   */
  static extract(html) {
    const container = document.createElement("div");
    container.innerHTML = RichText.sanitize(html);
    const seen = new Set();
    /** @type {MentionReference[]} */
    const references = [];

    container.querySelectorAll("[data-nd-mention]").forEach((mention) => {
      const kind = mention.getAttribute("data-mention-kind") ?? "";
      const id = mention.getAttribute("data-mention-id") ?? "";
      const uuid = mention.getAttribute("data-mention-uuid") ?? "";
      const name = (mention.textContent ?? "").replace(/^@/, "").trim();
      const identity = `${kind}:${uuid || id}`;
      if (!kind || (!uuid && !id) || seen.has(identity)) return;
      seen.add(identity);
      references.push({ kind, id, uuid, name });
    });
    return references;
  }

  /**
   * @param {HTMLElement} editor
   * @param {MentionState} state
   */
  static #update(editor, state) {
    const trigger = EntityMentions.#triggerRange(editor);
    if (!trigger) {
      EntityMentions.#close(state);
      return;
    }

    const groups = MentionProvider.search(trigger.query);
    state.entries = groups.flatMap((group) => group.entries);
    state.activeIndex = 0;
    state.replaceRange = trigger.range;

    if (state.entries.length === 0) {
      EntityMentions.#close(state);
      return;
    }

    state.popup.replaceChildren();
    let optionIndex = 0;
    for (const group of groups) {
      const heading = document.createElement("div");
      heading.className = "nd-mention-popup__group";
      heading.textContent = group.label;
      state.popup.append(heading);

      for (const entry of group.entries) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nd-mention-popup__option";
        button.dataset.mentionOption = String(optionIndex);
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", optionIndex === 0 ? "true" : "false");

        if (entry.img) {
          const image = document.createElement("img");
          image.src = entry.img;
          image.alt = "";
          button.append(image);
        }
        const name = document.createElement("span");
        name.textContent = entry.name;
        button.append(name);
        state.popup.append(button);
        optionIndex += 1;
      }
    }

    const caret = trigger.caretRect;
    state.popup.style.left = `${Math.max(8, Math.min(window.innerWidth - 288, caret.left))}px`;
    state.popup.style.top = `${Math.max(8, Math.min(window.innerHeight - 248, caret.bottom + 4))}px`;
    state.popup.hidden = false;
  }

  /**
   * @param {HTMLElement} editor
   * @returns {{ query: string, range: Range, caretRect: DOMRect }|null}
   */
  static #triggerRange(editor) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    const caretRange = selection.getRangeAt(0);
    if (!caretRange.collapsed || !editor.contains(caretRange.commonAncestorContainer)) return null;
    if (caretRange.startContainer.nodeType !== Node.TEXT_NODE) return null;

    const node = caretRange.startContainer;
    const before = (node.textContent ?? "").slice(0, caretRange.startOffset);
    const match = before.match(/(?:^|\s)@([^@\n]{0,60})$/);
    if (!match) return null;

    const atOffset = before.lastIndexOf("@");
    if (atOffset < 0) return null;
    const range = caretRange.cloneRange();
    range.setStart(node, atOffset);
    const caretRect = caretRange.getBoundingClientRect();
    const fallback = editor.getBoundingClientRect();

    return {
      query: match[1],
      range,
      caretRect: caretRect.width || caretRect.height ? caretRect : fallback
    };
  }

  /**
   * @param {HTMLElement} editor
   * @param {MentionState} state
   * @param {KeyboardEvent} event
   */
  static #onKeyDown(editor, state, event) {
    if (state.popup.hidden || state.entries.length === 0) return;
    if (event.key === "Escape") {
      event.preventDefault();
      EntityMentions.#close(state);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      state.activeIndex =
        (state.activeIndex + delta + state.entries.length) % state.entries.length;
      EntityMentions.#paintActive(state);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      EntityMentions.#insert(editor, state, state.activeIndex);
    }
  }

  /**
   * @param {MentionState} state
   */
  static #paintActive(state) {
    state.popup.querySelectorAll("[data-mention-option]").forEach((option, index) => {
      const active = index === state.activeIndex;
      option.setAttribute("aria-selected", active ? "true" : "false");
      if (active) option.scrollIntoView({ block: "nearest" });
    });
  }

  /**
   * @param {HTMLElement} editor
   * @param {MentionState} state
   * @param {number} index
   */
  static #insert(editor, state, index) {
    const entry = state.entries[index];
    const range = state.replaceRange;
    if (!entry || !(range instanceof Range) || !editor.contains(range.commonAncestorContainer)) {
      EntityMentions.#close(state);
      return;
    }

    const mention = document.createElement("span");
    mention.className = "nd-mention";
    mention.dataset.ndMention = "";
    mention.dataset.mentionKind = entry.kind;
    mention.dataset.mentionId = entry.id;
    mention.dataset.mentionUuid = entry.uuid;
    mention.contentEditable = "false";
    mention.textContent = `@${entry.name}`;

    const space = document.createTextNode("\u00A0");
    const fragment = document.createDocumentFragment();
    fragment.append(mention, space);
    range.deleteContents();
    range.insertNode(fragment);
    range.setStartAfter(space);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: `@${entry.name}`
    }));
    EntityMentions.#close(state);
  }

  /**
   * @param {MentionState} state
   */
  static #close(state) {
    state.popup.hidden = true;
    state.entries = [];
    state.activeIndex = 0;
    state.replaceRange = null;
  }
}

/**
 * @typedef {object} MentionReference
 * @property {string} kind
 * @property {string} id
 * @property {string} uuid
 * @property {string} name
 */

/**
 * @typedef {object} MentionState
 * @property {AbortController} controller
 * @property {HTMLElement} popup
 * @property {import("./mention-provider.js").MentionEntry[]} entries
 * @property {number} activeIndex
 * @property {Range|null} replaceRange
 */
