const ALLOWED_TAGS = new Set([
  "BR",
  "EM",
  "H2",
  "H3",
  "LI",
  "OL",
  "P",
  "SPAN",
  "STRONG",
  "U",
  "UL"
]);

const COLOR_CLASSES = new Set([
  "nd-color-blue",
  "nd-color-green",
  "nd-color-yellow",
  "nd-color-orange",
  "nd-color-red",
  "nd-color-purple",
  "nd-color-gray"
]);

/**
 * Lightweight native rich-text helpers.
 * Uses contenteditable plus Selection/Range APIs; it is intentionally not a
 * document model or general-purpose editing engine.
 */
export class RichText {
  /**
   * Allow only the formatting supported by the Playbook toolbar.
   * @param {string} html
   * @returns {string}
   */
  static sanitize(html) {
    const source = document.createElement("template");
    source.innerHTML = String(html ?? "");

    const output = document.createElement("div");
    for (const child of [...source.content.childNodes]) {
      const clean = RichText.#sanitizeNode(child);
      if (clean) output.append(clean);
    }
    return output.innerHTML;
  }

  /**
   * Convert stored HTML to a compact excerpt for the Now/Next strip.
   * @param {string} html
   * @returns {string}
   */
  static plainText(html) {
    const container = document.createElement("div");
    container.innerHTML = RichText.sanitize(html);
    return (container.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  /**
   * @param {string} html
   * @returns {boolean}
   */
  static hasContent(html) {
    return RichText.plainText(html).length > 0;
  }

  /**
   * Insert sanitized clipboard HTML, falling back to plain text.
   * @param {HTMLElement} editor
   * @param {ClipboardEvent} event
   */
  static paste(editor, event) {
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!RichText.#containsRange(editor, range)) return;

    const clipboard = event.clipboardData;
    const rawHtml = clipboard?.getData("text/html") ?? "";
    const rawText = clipboard?.getData("text/plain") ?? "";
    const safeHtml = rawHtml ? RichText.sanitize(rawHtml) : "";

    range.deleteContents();
    if (safeHtml) {
      const template = document.createElement("template");
      template.innerHTML = safeHtml;
      const fragment = template.content;
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) range.setStartAfter(last);
    } else {
      const text = document.createTextNode(rawText);
      range.insertNode(text);
      range.setStartAfter(text);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  }

  /**
   * Apply one supported toolbar command to a saved selection.
   * @param {HTMLElement} editor
   * @param {Range} savedRange
   * @param {string} command
   * @param {string} [value]
   * @returns {Range|null}
   */
  static apply(editor, savedRange, command, value = "") {
    if (!(editor instanceof HTMLElement) || !(savedRange instanceof Range)) return null;
    if (!RichText.#containsRange(editor, savedRange)) return null;

    editor.focus();
    const selection = window.getSelection();
    const range = savedRange.cloneRange();
    selection?.removeAllRanges();
    selection?.addRange(range);

    if (command === "bold") RichText.#wrapInline(range, "strong");
    else if (command === "italic") RichText.#wrapInline(range, "em");
    else if (command === "underline") RichText.#wrapInline(range, "u");
    else if (command === "heading") RichText.#applyBlock(editor, range, value);
    else if (command === "list") RichText.#applyList(editor, range, value);
    else if (command === "color") RichText.#applyColor(range, value);
    else if (command === "clear") RichText.#clearFormatting(editor, range);
    else return null;

    const next = RichText.#currentRange(editor);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatSetBlockTextDirection" }));
    return next;
  }

  /**
   * @param {Node} node
   * @returns {Node|null}
   */
  static #sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }
    if (!(node instanceof Element)) return null;

    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)) return null;

    let tag = node.tagName;
    if (tag === "B") tag = "STRONG";
    if (tag === "I") tag = "EM";
    if (tag === "DIV") tag = "P";
    if (tag === "H1") tag = "H2";

    const fragment = document.createDocumentFragment();
    for (const child of [...node.childNodes]) {
      const clean = RichText.#sanitizeNode(child);
      if (clean) fragment.append(clean);
    }

    if (!ALLOWED_TAGS.has(tag)) return fragment;

    const clean = document.createElement(tag.toLowerCase());
    if (tag === "SPAN") {
      if (node.hasAttribute("data-nd-mention")) {
        const kind = (node.getAttribute("data-mention-kind") ?? "").slice(0, 64);
        const id = (node.getAttribute("data-mention-id") ?? "").slice(0, 256);
        const uuid = (node.getAttribute("data-mention-uuid") ?? "").slice(0, 256);
        if (!/^[a-z][a-zA-Z0-9-]*$/.test(kind) || (!id && !uuid)) return fragment;
        clean.className = "nd-mention";
        clean.dataset.ndMention = "";
        clean.dataset.mentionKind = kind;
        clean.dataset.mentionId = id;
        clean.dataset.mentionUuid = uuid;
        clean.contentEditable = "false";
        clean.textContent = node.textContent ?? "";
        return clean;
      }
      const colorClass = [...node.classList].find((name) => COLOR_CLASSES.has(name));
      if (colorClass) clean.className = colorClass;
      else return fragment;
    }
    clean.append(fragment);
    return clean;
  }

  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   * @returns {boolean}
   */
  static #containsRange(editor, range) {
    return editor.contains(range.commonAncestorContainer);
  }

  /**
   * @param {HTMLElement} editor
   * @returns {Range|null}
   */
  static #currentRange(editor) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return RichText.#containsRange(editor, range) ? range.cloneRange() : null;
  }

  /**
   * @param {Range} range
   * @param {"strong"|"em"|"u"} tag
   */
  static #wrapInline(range, tag) {
    const wrapper = document.createElement(tag);
    if (range.collapsed) {
      const marker = document.createTextNode("\u200B");
      wrapper.append(marker);
      range.insertNode(wrapper);
      range.setStart(marker, 1);
      range.collapse(true);
    } else {
      wrapper.append(range.extractContents());
      range.insertNode(wrapper);
      range.selectNodeContents(wrapper);
    }
    RichText.#select(range);
  }

  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   * @param {string} tag
   */
  static #applyBlock(editor, range, tag) {
    if (!["h2", "h3"].includes(tag)) return;
    const blocks = RichText.#selectedBlocks(editor, range);

    if (blocks.length) {
      let first = null;
      let last = null;
      for (const block of blocks) {
        const replacement = document.createElement(tag);
        replacement.append(...block.childNodes);
        block.replaceWith(replacement);
        first ??= replacement;
        last = replacement;
      }
      range.setStart(first, 0);
      range.setEnd(last, last.childNodes.length);
    } else {
      const heading = document.createElement(tag);
      if (range.collapsed) heading.append(document.createElement("br"));
      else heading.append(range.extractContents());
      range.insertNode(heading);
      range.selectNodeContents(heading);
    }
    RichText.#select(range);
  }

  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   * @param {string} tag
   */
  static #applyList(editor, range, tag) {
    if (!["ul", "ol"].includes(tag)) return;

    const anchor = range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
    const existingItem = anchor?.closest("li");
    const existingList = existingItem?.parentElement;
    if (existingList && editor.contains(existingList)) {
      if (existingList.tagName.toLowerCase() === tag) return;
      const replacement = document.createElement(tag);
      replacement.append(...existingList.childNodes);
      existingList.replaceWith(replacement);
      range.selectNodeContents(replacement);
      RichText.#select(range);
      return;
    }

    const list = document.createElement(tag);
    const blocks = RichText.#selectedBlocks(editor, range);
    if (blocks.length) {
      const marker = document.createComment("nd-list");
      blocks[0].before(marker);
      for (const block of blocks) {
        const item = document.createElement("li");
        item.append(...block.childNodes);
        list.append(item);
        block.remove();
      }
      marker.replaceWith(list);
    } else {
      const item = document.createElement("li");
      if (range.collapsed) item.append(document.createElement("br"));
      else item.append(range.extractContents());
      list.append(item);
      range.insertNode(list);
    }
    range.selectNodeContents(list);
    RichText.#select(range);
  }

  /**
   * @param {Range} range
   * @param {string} color
   */
  static #applyColor(range, color) {
    if (color === "default") {
      if (range.collapsed) {
        const anchor = range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;
        const colorSpan = anchor?.closest("span");
        if (colorSpan && [...colorSpan.classList].some((name) => COLOR_CLASSES.has(name))) {
          const marker = document.createComment("nd-color");
          range.insertNode(marker);
          colorSpan.replaceWith(...colorSpan.childNodes);
          const parent = marker.parentNode;
          const offset = parent ? [...parent.childNodes].indexOf(marker) : 0;
          marker.remove();
          if (parent) {
            range.setStart(parent, offset);
            range.collapse(true);
          }
          RichText.#select(range);
        }
        return;
      }
      RichText.#replaceSelectionWithCleanText(range, false);
      return;
    }
    const className = `nd-color-${color}`;
    if (!COLOR_CLASSES.has(className)) return;
    const span = document.createElement("span");
    span.className = className;
    if (range.collapsed) {
      const marker = document.createTextNode("\u200B");
      span.append(marker);
      range.insertNode(span);
      range.setStart(marker, 1);
      range.collapse(true);
    } else {
      span.append(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
    }
    RichText.#select(range);
  }

  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   */
  static #clearFormatting(editor, range) {
    if (!range.collapsed) {
      RichText.#replaceSelectionWithCleanText(range, true);
      return;
    }

    const anchor = range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
    const block = anchor?.closest("h2, h3, p, li");
    if (!block || !editor.contains(block)) return;
    const replacement = document.createElement(block.tagName === "LI" ? "li" : "p");
    replacement.textContent = block.textContent ?? "";
    block.replaceWith(replacement);
    range.selectNodeContents(replacement);
    range.collapse(false);
    RichText.#select(range);
  }

  /**
   * Default color removes semantic-color markup while preserving other inline formatting.
   * Clear formatting passes plain=true and removes all markup from the selection.
   * @param {Range} range
   * @param {boolean} plain
   */
  static #replaceSelectionWithCleanText(range, plain) {
    const fragment = range.extractContents();
    let replacement;
    if (plain) {
      replacement = document.createTextNode(fragment.textContent ?? "");
    } else {
      const wrapper = document.createElement("span");
      wrapper.append(fragment);
      for (const span of [...wrapper.querySelectorAll("span")]) {
        if ([...span.classList].some((name) => COLOR_CLASSES.has(name))) {
          span.replaceWith(...span.childNodes);
        }
      }
      replacement = document.createDocumentFragment();
      replacement.append(...wrapper.childNodes);
    }

    const last = replacement.lastChild ?? replacement;
    range.insertNode(replacement);
    if (last instanceof Node && last.parentNode) {
      range.setStartAfter(last);
      range.collapse(true);
    }
    RichText.#select(range);
  }

  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   * @returns {HTMLElement[]}
   */
  static #selectedBlocks(editor, range) {
    const blocks = [...editor.querySelectorAll(":scope > p, :scope > h2, :scope > h3")];
    return blocks.filter((block) => {
      try {
        return range.intersectsNode(block);
      } catch {
        return false;
      }
    });
  }

  /**
   * @param {Range} range
   */
  static #select(range) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
