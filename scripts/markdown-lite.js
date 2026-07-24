/**
 * Lightweight markdown → HTML for AI responses.
 * Not a full CommonMark parser — enough for Copilot summaries.
 */

import { RichText } from "./rich-text.js";

export class MarkdownLite {
  /**
   * @param {string} markdown
   * @returns {string} sanitized HTML
   */
  static toSafeHtml(markdown) {
    const raw = MarkdownLite.#toHtml(String(markdown ?? ""));
    return RichText.sanitize(raw);
  }

  /**
   * @param {string} markdown
   * @returns {string}
   */
  static #toHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    /** @type {string[]} */
    const html = [];
    /** @type {"ul"|"ol"|null} */
    let listType = null;

    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        continue;
      }

      const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${MarkdownLite.#inline(heading[2])}</h${level}>`);
        continue;
      }

      const ul = /^[-*]\s+(.*)$/.exec(trimmed);
      if (ul) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html.push("<ul>");
        }
        html.push(`<li>${MarkdownLite.#inline(ul[1])}</li>`);
        continue;
      }

      const ol = /^(\d+)\.\s+(.*)$/.exec(trimmed);
      if (ol) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          html.push("<ol>");
        }
        html.push(`<li>${MarkdownLite.#inline(ol[2])}</li>`);
        continue;
      }

      closeList();
      html.push(`<p>${MarkdownLite.#inline(trimmed)}</p>`);
    }

    closeList();
    return html.join("") || "<p></p>";
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  static #inline(text) {
    let value = MarkdownLite.#escape(text);
    value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
    value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return value;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  static #escape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
