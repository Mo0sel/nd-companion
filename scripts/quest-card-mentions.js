import { EntityMentions } from "./entity-mentions.js";
import { EntityRegistry } from "./entity-registry.js";

/** Reuse the shared mention picker; Foundry remains the document authority. */
export class QuestCardMentions {
  static attach(editor) {
    EntityMentions.attach(editor, { kinds: ["actor", "scene", "journal", "item"] });
    editor.addEventListener("click", event => {
      const tag = event.target.closest?.('[data-nd-mention]');
      if (!tag) return;
      event.preventDefault();
      event.stopPropagation();
      void this.open(tag);
    });
    editor.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key) || !event.target.matches('[data-nd-mention]')) return;
      event.preventDefault();
      event.stopPropagation();
      void this.open(event.target);
    });
  }

  static decorate(editor) {
    editor.querySelectorAll('[data-nd-mention]').forEach(tag => {
      tag.tabIndex = 0;
      tag.setAttribute('role', 'link');
      tag.title = `Open ${tag.textContent.replace(/^@/, '')}`;
    });
  }

  static detach(root) {
    root?.querySelectorAll('[data-card-body]').forEach(editor => EntityMentions.detach(editor));
  }

  static async open(tag) {
    try {
      const entity = EntityRegistry.findByUUID(tag.dataset.mentionUuid);
      if (!entity || !["actor", "scene", "journal", "item"].includes(entity.kind)) {
        throw new Error("This linked document is no longer available.");
      }
      const doc = entity.document;
      if (!doc?.testUserPermission(game.user, "OBSERVER")) {
        throw new Error("You do not have permission to open this document.");
      }
      if (entity.kind === "scene") {
        // View the map for this user; do not activate it for the whole table.
        await doc.view();
        return;
      }
      if (!doc.sheet) throw new Error("This document has no available sheet.");
      await doc.sheet.render(true);
      doc.sheet.bringToFront?.();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }
}
