/** Quest card data and legacy field links. No second copy of legacy notes. */
export class QuestCards {
  static fields = {
    speechNotes: "Speech Notes", setup: "Setup", objective: "Objectives",
    experience: "Experience & Reward", twist: "Twist",
    possibleOutcomes: "Possible Outcomes", gmNotes: "GM Notes"
  };

  static imagePath(value) {
    const path = typeof value === "string" ? value.trim() : "";
    if (!path || /[\u0000-\u001f\\]/.test(path) || path.startsWith("//")) return "";
    if (/^[a-z][\w+.-]*:/i.test(path) && !/^https?:\/\//i.test(path)) return "";
    return path;
  }

  static normalize(cards) {
    if (!Array.isArray(cards)) return null;
    const ids = new Set();
    return cards.filter(card => card && typeof card === "object").map(card => {
      let id = typeof card.id === "string" && /^[\w-]+$/.test(card.id) ? card.id : foundry.utils.randomID();
      if (ids.has(id)) id = foundry.utils.randomID();
      ids.add(id);
      return {
        id, title: typeof card.title === "string" ? card.title : "",
        body: typeof card.body === "string" ? card.body : "",
        field: Object.hasOwn(this.fields, card.field) ? card.field : null,
        image: this.imagePath(card.image),
        column: card.column === 1 ? 1 : 0
      };
    });
  }

  static forBeat(beat) {
    const cards = this.normalize(beat.cards) ?? Object.entries(this.fields)
      .filter(([field]) => typeof beat[field] === "string" && beat[field].trim())
      .map(([field, title], index) => ({ id: `legacy-${field}`, title, field, body: "", image: "", column: index % 2 }));
    return cards.map(card => ({ ...card, body: card.field ? (beat[card.field] ?? "") : card.body }));
  }

  /** Campaign entries use different names for the two historical note fields. */
  static forEntry(entry) {
    return this.forBeat({ ...entry, experience: entry.reward, gmNotes: entry.notes });
  }
}
