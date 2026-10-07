import { QuestCards } from "./quest-cards.js";

export class QuestImages {
  /** Use the configured picker so Forge can supply its own upload integration. */
  static choose(current, onChoose) {
    if (!game.user?.isGM) throw new Error("Only a GM can attach quest images.");
    const Picker = foundry.applications.apps.FilePicker.implementation;
    const picker = new Picker({
      type: "image", current,
      callback: async path => {
        try {
          const safe = QuestCards.imagePath(path);
          if (!safe) throw new Error("Choose a saved image file or an HTTP(S) image URL.");
          await onChoose(safe);
        } catch (error) { ui.notifications.error(error.message); }
      }
    });
    return picker.render(true);
  }

  static preview(path) {
    const src = QuestCards.imagePath(path);
    if (!src) throw new Error("No valid image is attached.");
    return new foundry.applications.apps.ImagePopout({ src, window: { title: "Quest image" } }).render(true);
  }

  static share(path) {
    if (!game.user?.isGM) throw new Error("Only a GM can share quest images.");
    const src = QuestCards.imagePath(path);
    if (!src) throw new Error("No valid image is attached.");
    const users = game.users.filter(user => user.active && !user.isGM).map(user => user.id);
    if (!users.length) { ui.notifications.info("No players are currently connected."); return; }
    const popout = new foundry.applications.apps.ImagePopout({ src, window: { title: "Quest image" } });
    // Do not transmit the card's potentially private GM title or body.
    popout.shareImage({ image: src, title: "Quest image", showTitle: false, users });
    ui.notifications.info("Image shown to connected players.");
  }
}
