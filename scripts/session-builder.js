import { Playbook } from "./playbook.js";
import { PlaybookPrepare } from "./playbook-prepare.js";
import { PlaybookService } from "./playbook-service.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { StoryThreadService } from "./story-thread-service.js";

/**
 * Legacy workflow for cloning campaign Story Entries into the active Session.
 */
export class SessionBuilder {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /**
   * @param {HTMLElement} root
   */
  static attach(root) {
    if (!(root instanceof HTMLElement)) return;
    const prepare = root.querySelector("[data-playbook-prepare]");
    const dialog = root.querySelector("[data-session-import]");
    if (!(prepare instanceof HTMLElement) || !(dialog instanceof HTMLElement)) return;

    SessionBuilder.#listeners.get(prepare)?.abort();
    const controller = new AbortController();
    SessionBuilder.#listeners.set(prepare, controller);

    prepare.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-open-campaign-import]")) {
          SessionBuilder.paint(root);
          dialog.hidden = false;
          return;
        }
        if (target.closest("[data-close-campaign-import]")) {
          dialog.hidden = true;
          return;
        }
        if (target.closest("[data-import-campaign-entries]")) {
          void SessionBuilder.#import(root, dialog);
        }
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {HTMLElement} root
   */
  static paint(root) {
    const list = root.querySelector("[data-session-import-list]");
    if (!list) return;
    list.replaceChildren();

    const storyThreads = StoryThreadService.list();
    const imported = new Set(
      PlaybookService.getDocument().beats.map((entry) => entry.sourceStoryEntryId).filter(Boolean)
    );
    let count = 0;

    for (const storyThread of storyThreads) {
        const entries = QuestEntryService.listForStoryThread(storyThread.id);
        if (!entries.length) continue;
        const group = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = storyThread.title?.trim() || "Untitled Story Thread";
        group.append(legend);

        for (const entry of entries) {
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = entry.id;
          checkbox.dataset.sessionImportEntry = "";
          checkbox.disabled = imported.has(entry.id);
          const title = document.createElement("span");
          title.textContent = entry.title?.trim() || "Untitled Entry";
          if (checkbox.disabled) {
            const state = document.createElement("small");
            state.textContent = "Already imported";
            label.append(checkbox, title, state);
          } else {
            label.append(checkbox, title);
          }
          group.append(label);
          count += 1;
        }
        list.append(group);
    }

    if (count === 0) {
      const empty = document.createElement("p");
      empty.className = "nd-campaign-empty";
      empty.textContent = "No Story Entries are available to import.";
      list.append(empty);
    }
  }

  static async #import(root, dialog) {
    const ids = [...dialog.querySelectorAll("[data-session-import-entry]:checked")]
      .filter((checkbox) => checkbox instanceof HTMLInputElement)
      .map((checkbox) => checkbox.value);
    const entries = ids.map((id) => QuestEntryService.getById(id)).filter(Boolean);
    if (!entries.length) return;
    await PlaybookService.importStoryEntries(entries);
    dialog.hidden = true;
    PlaybookPrepare.paint(root);
    Playbook.refreshOpen();
  }
}
