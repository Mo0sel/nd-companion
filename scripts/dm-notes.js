import { LiveNotes } from "./live-notes.js";
import { RichText } from "./rich-text.js";
import { RichTextToolbar } from "./rich-text-toolbar.js";

/**
 * Reusable DM Notes editor.
 * Storage-key only — callers resolve the campaignMemory key.
 */
export class DmNotes {
  /**
   * @param {HTMLElement|null} host
   * @param {{ storageKey?: string|null }} [options]
   */
  static paint(host, options = {}) {
    if (!(host instanceof HTMLElement)) return;

    const storageKey =
      typeof options.storageKey === "string" && options.storageKey.trim()
        ? options.storageKey.trim()
        : "";

    if (!storageKey) {
      const editor = host.querySelector("[data-dm-notes-editor]");
      if (editor instanceof HTMLElement) LiveNotes.detach(editor);
      host.replaceChildren();
      host.hidden = true;
      return;
    }

    host.hidden = false;
    host.className = "nd-dm-notes";
    host.dataset.liveNotesRoot = "";
    host.setAttribute("aria-label", "DM Notes");

    let editor = host.querySelector("[data-dm-notes-editor]");
    if (!(editor instanceof HTMLElement)) {
      host.replaceChildren();
      const header = document.createElement("header");
      header.className = "nd-dm-notes__header";
      const titles = document.createElement("div");
      const eyebrow = document.createElement("div");
      eyebrow.className = "nd-campaign-panel__eyebrow nd-hierarchy-context";
      eyebrow.textContent = "Private";
      const title = document.createElement("h3");
      title.className = "nd-hierarchy-group";
      title.textContent = "DM Notes";
      titles.append(eyebrow, title);
      const status = document.createElement("span");
      status.className = "nd-live-notes__status";
      status.dataset.liveNotesStatus = "";
      status.hidden = true;
      header.append(titles, status);

      const toolbar = document.createElement("div");
      toolbar.className = "nd-richtext-toolbar";
      toolbar.dataset.richtextToolbar = "";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "DM Notes formatting");
      toolbar.innerHTML = [
        `<button type="button" data-richtext-command="bold" aria-label="Bold"><strong>B</strong></button>`,
        `<button type="button" data-richtext-command="italic" aria-label="Italic"><em>I</em></button>`,
        `<button type="button" data-richtext-command="underline" aria-label="Underline"><u>U</u></button>`,
        `<span class="nd-richtext-toolbar__divider" aria-hidden="true"></span>`,
        `<button type="button" data-richtext-command="heading" data-richtext-value="h2">H2</button>`,
        `<button type="button" data-richtext-command="heading" data-richtext-value="h3">H3</button>`,
        `<button type="button" data-richtext-command="list" data-richtext-value="ul">• List</button>`,
        `<button type="button" data-richtext-command="list" data-richtext-value="ol">1. List</button>`,
        `<button type="button" data-richtext-command="clear">Clear</button>`
      ].join("");

      editor = document.createElement("div");
      editor.className =
        "nd-dm-notes__editor nd-richtext nd-richtext--editor nd-live-notes";
      editor.dataset.dmNotesEditor = "";
      editor.dataset.richtextEditor = "";
      editor.dataset.placeholder = "Private notes for this entity...";
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-label", "DM Notes");

      host.append(header, toolbar, editor);
    }

    RichTextToolbar.attach(host);
    LiveNotes.attach(editor, storageKey, {
      memory: true,
      html: true,
      sanitize: RichText.sanitize
    });
  }
}
