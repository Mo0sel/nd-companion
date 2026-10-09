import { QuestCards } from "./quest-cards.js";
import { QuestImages } from "./quest-images.js";
import { PlaybookService } from "./playbook-service.js";
import { LiveNotes } from "./live-notes.js";
import { RichText } from "./rich-text.js";
import { PlayCardState } from "./play-card-state.js";
import { CompanionStorage } from "./storage.js";
import { QuestCardMentions } from "./quest-card-mentions.js";

export class QuestCardPanel {
  static #states = new WeakMap();

  static paint(root, snapshot, refresh) {
    const host = root.querySelector("[data-quest-cards]");
    if (!host) return;
    host.hidden = snapshot.total === 0;
    if (snapshot.total === 0) {
      QuestCardMentions.detach(host);
      host.replaceChildren();
      this.#states.delete(host);
      return;
    }
    const beat = snapshot.beat;
    let state = this.#states.get(host);
    if (!state || state.beatId !== beat.id) {
      QuestCardMentions.detach(host);
      host.querySelectorAll('[contenteditable="true"]').forEach(el => LiveNotes.detach(el));
      host.replaceChildren();
      state = { beatId: beat.id, nodes: new Map(), refresh, busy: false, removed: null };
      this.#states.set(host, state);
      const header = document.createElement("div");
      header.className = "nd-quest-cards__header";
      header.dataset.liveNotesRoot = "";
      const title = document.createElement("div");
      title.className = "nd-quest-cards__title nd-play-inline-editor";
      title.dataset.placeholder = "Quest name";
      title.dataset.questTitle = "";
      title.dataset.playBeatId = beat.id;
      title.setAttribute("role", "textbox");
      title.setAttribute("aria-label", "Quest name");
      LiveNotes.attach(title, null, { load: () => beat.title, save: value => PlaybookService.updateBeatById(beat.id, { title: value }) });
      this.#plainTitle(title);
      state.title = title;
      const add = this.#button("+ Add card", "Add card", () => this.#run(host, state, async () => {
        const id = foundry.utils.randomID();
        await PlaybookService.mutateCards(beat.id, cards => {
          const count = cards.filter(card => card.column === 0).length;
          cards.push({ id, title: "", body: "", field: null, image: "", column: count <= cards.length - count ? 0 : 1 });
        });
        refresh();
        PlayCardState.setOpen(host, id, true);
        state.nodes.get(id)?.querySelector("[data-card-title]")?.focus();
      }));
      add.className = "nd-quest-cards__add";
      add.dataset.questAdd = "";
      state.undo = this.#button("Undo remove", "Restore removed card", () => this.#run(host, state, async () => {
        const removed = state.removed;
        if (!removed) return;
        await PlaybookService.mutateCards(beat.id, cards => cards.splice(Math.min(removed.index, cards.length), 0, removed.card));
        state.removed = null;
        refresh();
      }));
      state.undo.hidden = true;
      const expand = this.#button("Expand all", "Expand all cards", () => {
        for (const id of state.nodes.keys()) PlayCardState.setOpen(host, id, true);
      });
      const collapse = this.#button("Collapse all", "Collapse all cards", () => {
        for (const id of state.nodes.keys()) PlayCardState.setOpen(host, id, false);
      });
      expand.dataset.cardsExpand = "";
      collapse.dataset.cardsCollapse = "";
      header.append(title, this.#status(), state.undo, expand, collapse, add);
      const grid = document.createElement("div");
      grid.className = "nd-play-entry-grid";
      state.columns = [0, 1].map(() => {
        const column = document.createElement("div");
        column.className = "nd-play-entry-column"; grid.append(column); return column;
      });
      state.empty = document.createElement("p");
      state.empty.className = "nd-quest-cards__hint";
      state.empty.textContent = "Add a card for each step, clue, objective, reward, or image.";
      host.append(header, state.empty, grid);
    }
    if (!LiveNotes.isProtected(state.title) && state.title.textContent !== beat.title) state.title.textContent = beat.title;
    const cards = QuestCards.forBeat(beat);
    state.empty.hidden = cards.length > 0;
    state.undo.hidden = !state.removed;
    for (const [id, node] of state.nodes) {
      if (cards.some(card => card.id === id)) continue;
      if ([...node.querySelectorAll('[contenteditable="true"]')].some(LiveNotes.hasPending)) continue;
      QuestCardMentions.detach(node);
      node.querySelectorAll('[contenteditable="true"]').forEach(el => LiveNotes.detach(el));
      node.remove(); state.nodes.delete(id);
    }
    const positions = [0, 0];
    for (const card of cards) {
      let node = state.nodes.get(card.id);
      if (!node) {
        node = this.#card(host, state, card);
        state.nodes.set(card.id, node);
        state.columns[card.column].append(node);
      }
      const column = state.columns[card.column];
      const next = column.children[positions[card.column]++] ?? null;
      if (next !== node && !node.contains(document.activeElement)) column.insertBefore(node, next);
      const title = node.querySelector("[data-card-title]");
      const body = node.querySelector("[data-card-body]");
      if (!LiveNotes.isProtected(title) && title.textContent !== card.title) title.textContent = card.title;
      const safe = RichText.sanitize(card.body);
      if (!LiveNotes.isProtected(body) && body.innerHTML !== safe) body.innerHTML = safe;
      QuestCardMentions.decorate(body);
      const image = node.querySelector("img");
      if (card.image && image.getAttribute("src") !== card.image) {
        delete image.dataset.failed;
        image.src = card.image;
      }
      if (!card.image) { image.removeAttribute("src"); delete image.dataset.failed; }
      image.hidden = !card.image || image.dataset.failed === "true";
      node.querySelector("[data-image-error]").hidden = image.dataset.failed !== "true";
      node.querySelectorAll("[data-needs-image]").forEach(button => { button.hidden = !card.image; });
    }
    PlayCardState.paint(host, beat.id, cards.map(card => [card.id, RichText.hasContent(card.body) || Boolean(card.image)]), CompanionStorage.getAutoCollapseEmptySections());
  }

  static #card(host, state, card) {
    const node = document.createElement("details");
    node.className = "nd-play-card nd-quest-card";
    node.dataset.playbookFieldBlock = card.id;
    node.dataset.liveNotesRoot = "";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.className = "nd-quest-card__title nd-play-inline-editor";
    title.dataset.cardTitle = "";
    title.dataset.placeholder = "Card title";
    title.dataset.playBeatId = state.beatId;
    title.setAttribute("role", "textbox"); title.setAttribute("aria-label", "Card title");
    LiveNotes.attach(title, null, { load: () => card.title, save: value => PlaybookService.updateCard(state.beatId, card.id, { title: value }) });
    this.#plainTitle(title);
    const toggle = this.#button("", "Expand or collapse card", () => PlayCardState.setOpen(host, card.id, !node.open));
    toggle.className = "nd-play-card__collapse-label nd-quest-card__toggle";
    toggle.dataset.cardToggle = "";
    const remove = this.#button("−", "Remove card", () => this.#run(host, state, async () => {
      let removed;
      await PlaybookService.mutateCards(state.beatId, cards => {
        const index = cards.findIndex(item => item.id === card.id);
        if (index < 0) return;
        removed = { card: { ...cards[index] }, index }; cards.splice(index, 1);
      });
      state.removed = removed; state.refresh();
    }));
    remove.dataset.cardRemove = "";
    summary.append(toggle, title, remove);
    const body = document.createElement("div");
    body.className = "nd-play-card__content nd-richtext nd-play-inline-editor";
    body.dataset.cardBody = ""; body.dataset.playBeatId = state.beatId;
    body.dataset.placeholder = "Add notes… Type @ to tag an actor, scene/location, or journal.";
    body.setAttribute("role", "textbox"); body.setAttribute("aria-label", "Card content");
    body.setAttribute("aria-multiline", "true");
    LiveNotes.attach(body, null, { html: true, sanitize: RichText.sanitize, load: () => card.body,
      save: value => PlaybookService.updateCard(state.beatId, card.id, { body: value }) });
    body.addEventListener("paste", event => { event.preventDefault(); RichText.paste(body, event); });
    QuestCardMentions.attach(body);
    body.addEventListener("input", () => QuestCardMentions.decorate(body));
    const edit = this.#button("", "Edit card content", () => {
      PlayCardState.setOpen(host, card.id, true);
      body.focus();
    });
    edit.className = "nd-quest-card__edit";
    edit.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-5-3L3 16z"/></svg>';
    summary.insertBefore(edit, remove);
    const image = document.createElement("img");
    image.className = "nd-quest-card__image"; image.alt = "Quest image"; image.hidden = true;
    const imageError = document.createElement("p"); imageError.dataset.imageError = ""; imageError.hidden = true;
    imageError.textContent = "Image unavailable. Choose another file or check its access permissions.";
    image.addEventListener("error", () => { image.dataset.failed = "true"; image.hidden = true; imageError.hidden = false; });
    const actions = document.createElement("div"); actions.className = "nd-quest-card__actions";
    const current = () => QuestCards.forBeat(PlaybookService.getDocument().beats.find(item => item.id === state.beatId) ?? {}).find(item => item.id === card.id);
    const choose = this.#button("Choose / upload image", "Choose or upload an image", () => this.#run(host, state, async () => {
      await QuestImages.choose(current()?.image ?? "", async path => {
        await PlaybookService.updateCard(state.beatId, card.id, { image: path });
        state.refresh();
      });
    }));
    choose.dataset.cardImage = "";
    choose.textContent = "";
    choose.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg>';
    choose.className = "nd-quest-card__edit";
    summary.insertBefore(choose, edit);
    const preview = this.#button("Preview", "Preview image privately", () => this.#run(host, state, () => QuestImages.preview(current()?.image)));
    preview.dataset.needsImage = "";
    const share = this.#button("Show to players", "Show image to connected players", () => this.#run(host, state, () => QuestImages.share(current()?.image)));
    share.dataset.needsImage = ""; share.dataset.cardShare = "";
    const unlink = this.#button("Remove image", "Remove image from this card", () => this.#run(host, state, async () => {
      await PlaybookService.updateCard(state.beatId, card.id, { image: "" }); state.refresh();
    }));
    unlink.dataset.needsImage = "";
    const split = this.#button("Split into cards", "Split paragraphs or top-level bullets into separate cards", () => this.#run(host, state, async () => {
      await PlaybookService.mutateCards(state.beatId, cards => {
        const index = cards.findIndex(item => item.id === card.id);
        if (index < 0) throw new Error("Card no longer exists.");
        const template = document.createElement("div"); template.innerHTML = RichText.sanitize(cards[index].body);
        const blocks = [...template.childNodes].flatMap(node => node instanceof Element && ["UL", "OL"].includes(node.tagName)
          ? [...node.children].map(li => `<${node.tagName.toLowerCase()}>${li.outerHTML}</${node.tagName.toLowerCase()}>`)
          : [node instanceof Element ? node.outerHTML : (() => {
            const p = document.createElement("p"); p.textContent = node.textContent; return p.outerHTML;
          })()])
          .filter(html => RichText.hasContent(html));
        if (blocks.length < 2) throw new Error("Add separate paragraphs or bullets before splitting this card.");
        cards[index].body = blocks[0];
        cards.splice(index + 1, 0, ...blocks.slice(1).map((body, offset) => ({
          id: foundry.utils.randomID(), title: "", body, field: null, image: "", column: (cards[index].column + offset + 1) % 2
        })));
      }); state.refresh();
    }));
    split.dataset.cardSplit = "";
    const tools = document.createElement("details");
    tools.className = "nd-quest-card__tools";
    const toolsLabel = document.createElement("summary");
    toolsLabel.textContent = "More";
    toolsLabel.setAttribute("aria-label", "More card actions");
    tools.append(toolsLabel, unlink, split);
    actions.append(preview, share, tools);
    node.append(summary, body, image, imageError, actions, this.#status());
    return node;
  }

  static #plainTitle(editor) {
    editor.setAttribute("aria-multiline", "false");
    editor.addEventListener("input", () => { if (!editor.textContent) editor.replaceChildren(); });
    editor.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); editor.blur(); } });
    // Editing a title must not toggle its containing details element.
    editor.addEventListener("click", event => event.stopPropagation());
    editor.addEventListener("paste", event => {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      range.deleteContents();
      const text = document.createTextNode((event.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " "));
      range.insertNode(text); range.setStartAfter(text); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
  }

  static #status() {
    const status = document.createElement("span"); status.dataset.liveNotesStatus = "";
    status.className = "nd-quest-card__status"; status.setAttribute("role", "status"); status.hidden = true; return status;
  }

  static #button(text, label, action) {
    const button = document.createElement("button"); button.type = "button";
    button.textContent = text; button.setAttribute("aria-label", label); button.title = label;
    button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void action(); });
    return button;
  }

  static async #run(host, state, action) {
    if (state.busy) return;
    state.busy = true;
    try { await LiveNotes.flushAll(host); await action(); }
    catch (error) { console.error("N&D Companion: quest card action failed", error); ui.notifications.error(error.message); }
    finally { state.busy = false; }
  }
}
