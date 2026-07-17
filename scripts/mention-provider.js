import { EntityRegistry } from "./entity-registry.js";
import { PlaybookService } from "./playbook-service.js";

const GROUP_LABELS = Object.freeze({
  actor: "Characters",
  item: "Items",
  scene: "Locations",
  journal: "Journals",
  rollTable: "Roll Tables",
  beat: "Beats"
});

/**
 * Generic mention source. Editors know only about groups and entries;
 * Foundry documents and Playbook Beats remain owned by their services.
 */
export class MentionProvider {
  /**
   * @param {string} query
   * @param {number} [limitPerGroup]
   * @returns {{ label: string, entries: MentionEntry[] }[]}
   */
  static search(query, limitPerGroup = 8) {
    const needle = String(query ?? "").trim().toLocaleLowerCase();
    const matches = (name) =>
      !needle || String(name ?? "").toLocaleLowerCase().startsWith(needle);

    /** @type {{ label: string, entries: MentionEntry[] }[]} */
    const groups = [];

    for (const kind of EntityRegistry.kinds()) {
      const entries = EntityRegistry.all(kind)
        .filter((entity) => matches(entity.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limitPerGroup)
        .map((entity) => ({
          kind,
          id: entity.id,
          uuid: entity.uuid,
          name: entity.name,
          img: entity.img
        }));
      if (entries.length) groups.push({ label: MentionProvider.#label(kind), entries });
    }

    const beatEntries = PlaybookService.getDocument()
      .beats
      .filter((beat) => matches(beat.title))
      .slice(0, limitPerGroup)
      .map((beat) => ({
        kind: "beat",
        id: beat.id,
        uuid: "",
        name: beat.title?.trim() || "Untitled Beat",
        img: ""
      }));
    if (beatEntries.length) {
      groups.push({ label: MentionProvider.#label("beat"), entries: beatEntries });
    }

    return groups;
  }

  /**
   * @param {string} kind
   * @returns {string}
   */
  static #label(kind) {
    if (GROUP_LABELS[kind]) return GROUP_LABELS[kind];
    return kind
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (letter) => letter.toUpperCase());
  }
}

/**
 * @typedef {object} MentionEntry
 * @property {string} kind
 * @property {string} id
 * @property {string} uuid
 * @property {string} name
 * @property {string} img
 */
