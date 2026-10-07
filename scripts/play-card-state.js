/** Temporary, per-window card choices. Campaign data is never changed here. */
export class PlayCardState {
  static #panels = new WeakMap();

  static paint(panel, beatId, sections, autoCollapse) {
    let state = this.#panels.get(panel);
    if (!state) {
      state = { beatId, choices: new Map() };
      this.#panels.set(panel, state);
      panel.addEventListener("click", (event) => {
        if (!(event.target instanceof Element)) return;
        const summary = event.target.closest("summary");
        const card = summary?.parentElement;
        if (!(card instanceof HTMLDetailsElement) || !card.dataset.playbookFieldBlock) return;
        if (event.target.closest("button, a, input, select, textarea")) return;
        // Keyboard activation also generates a click. Handle it synchronously:
        // native toggle events are queued and can arrive after a beat switch.
        event.preventDefault();
        this.setOpen(panel, card.dataset.playbookFieldBlock, !card.open);
      });
    }
    state.beatId = beatId;
    const choices = state.choices.get(beatId);
    for (const [key, hasContent] of sections) {
      const card = panel.querySelector(`[data-playbook-field-block="${key}"]`);
      if (!(card instanceof HTMLDetailsElement)) continue;
      const open = Boolean(beatId) && (choices?.get(key) ?? (!autoCollapse || hasContent));
      // A focused editor must not disappear during an automatic repaint.
      const editor = card.querySelector('[contenteditable="true"]');
      if (!open && editor?.dataset.playBeatId === beatId && editor.contains(document.activeElement)) continue;
      card.open = open;
    }
  }

  static setOpen(panel, key, open) {
    const state = this.#panels.get(panel);
    if (!state?.beatId) return;
    let choices = state.choices.get(state.beatId);
    if (!choices) state.choices.set(state.beatId, choices = new Map());
    choices.set(key, open);
    const card = panel.querySelector(`[data-playbook-field-block="${key}"]`);
    if (card instanceof HTMLDetailsElement) card.open = open;
  }
}
