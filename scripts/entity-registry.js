/**
 * Runtime index of world documents for Mentions, Search, and future graph/AI refs.
 * No persistence. Rebuilt per kind via Foundry document hooks.
 */

/** @typedef {"actor"|"item"|"scene"|"journal"|"rollTable"} EntityKind */

/**
 * @typedef {object} RegistryEntity
 * @property {string} uuid
 * @property {string} id
 * @property {EntityKind} kind
 * @property {string} name
 * @property {string} img
 * @property {foundry.abstract.Document} document
 * @property {boolean} ambiguous
 */

/**
 * @typedef {{ status: "ok", entity: RegistryEntity }
 *   | { status: "missing" }
 *   | { status: "ambiguous", entities: RegistryEntity[] }} NameLookupResult
 */

const KINDS = /** @type {const} */ (["actor", "item", "scene", "journal", "rollTable"]);

export class EntityRegistry {
  /** @type {Map<string, RegistryEntity>} */
  static #byUUID = new Map();

  /** @type {Map<EntityKind, RegistryEntity[]>} */
  static #byKind = new Map();

  /** @type {boolean} */
  static #hooksRegistered = false;

  /**
   * Build the full registry once world collections are available.
   */
  static ready() {
    for (const kind of KINDS) this.#rebuildKind(kind);
  }

  /**
   * Register create/update/delete hooks for indexed document types.
   */
  static registerHooks() {
    if (this.#hooksRegistered) return;
    this.#hooksRegistered = true;

    const bind = (kind, createHook, updateHook, deleteHook) => {
      Hooks.on(createHook, () => this.#rebuildKind(kind));
      Hooks.on(updateHook, () => this.#rebuildKind(kind));
      Hooks.on(deleteHook, () => this.#rebuildKind(kind));
    };

    bind("actor", "createActor", "updateActor", "deleteActor");
    bind("item", "createItem", "updateItem", "deleteItem");
    bind("scene", "createScene", "updateScene", "deleteScene");
    bind("journal", "createJournalEntry", "updateJournalEntry", "deleteJournalEntry");
    bind("rollTable", "createRollTable", "updateRollTable", "deleteRollTable");
  }

  /**
   * @param {string} uuid
   * @returns {RegistryEntity|null}
   */
  static findByUUID(uuid) {
    if (!uuid) return null;
    return this.#byUUID.get(uuid) ?? null;
  }

  /**
   * Exact name lookup (case-sensitive). Optional kind narrows the search.
   * @param {string} name
   * @param {EntityKind} [kind]
   * @returns {NameLookupResult}
   */
  static findByName(name, kind) {
    if (!name) return { status: "missing" };

    /** @type {RegistryEntity[]} */
    const matches = [];
    const kinds = kind ? [kind] : KINDS;

    for (const k of kinds) {
      const list = this.#byKind.get(k) ?? [];
      for (const entity of list) {
        if (entity.name === name) matches.push(entity);
      }
    }

    if (matches.length === 0) return { status: "missing" };
    if (matches.length === 1) return { status: "ok", entity: matches[0] };
    return { status: "ambiguous", entities: matches };
  }

  /**
   * @param {EntityKind} kind
   * @returns {RegistryEntity[]}
   */
  static all(kind) {
    return [...(this.#byKind.get(kind) ?? [])];
  }

  /**
   * Indexed kinds in display order. Mention editors consume this generically.
   * @returns {EntityKind[]}
   */
  static kinds() {
    return [...KINDS];
  }

  /**
   * Case-sensitive prefix search on entity names. Not fuzzy.
   * @param {string} prefix
   * @param {EntityKind} [kind]
   * @returns {RegistryEntity[]}
   */
  static search(prefix, kind) {
    if (!prefix) return [];

    /** @type {RegistryEntity[]} */
    const results = [];
    const kinds = kind ? [kind] : KINDS;

    for (const k of kinds) {
      const list = this.#byKind.get(k) ?? [];
      for (const entity of list) {
        if (entity.name.startsWith(prefix)) results.push(entity);
      }
    }

    return results;
  }

  /**
   * @param {EntityKind} kind
   */
  static #rebuildKind(kind) {
    const previous = this.#byKind.get(kind) ?? [];
    for (const entity of previous) this.#byUUID.delete(entity.uuid);

    const collection = this.#collectionFor(kind);
    /** @type {RegistryEntity[]} */
    const entities = [];

    if (collection) {
      for (const document of collection) {
        const entity = this.#normalize(kind, document);
        if (!entity) continue;
        entities.push(entity);
        this.#byUUID.set(entity.uuid, entity);
      }
    }

    const nameCounts = new Map();
    for (const entity of entities) {
      nameCounts.set(entity.name, (nameCounts.get(entity.name) ?? 0) + 1);
    }
    for (const entity of entities) {
      entity.ambiguous = (nameCounts.get(entity.name) ?? 0) > 1;
    }

    this.#byKind.set(kind, entities);
  }

  /**
   * @param {EntityKind} kind
   * @returns {Collection|null}
   */
  static #collectionFor(kind) {
    switch (kind) {
      case "actor":
        return game.actors ?? null;
      case "item":
        return game.items ?? null;
      case "scene":
        return game.scenes ?? null;
      case "journal":
        return game.journal ?? null;
      case "rollTable":
        return game.tables ?? null;
      default:
        return null;
    }
  }

  /**
   * @param {EntityKind} kind
   * @param {foundry.abstract.Document} document
   * @returns {RegistryEntity|null}
   */
  static #normalize(kind, document) {
    if (!document?.uuid || !document.id) return null;

    return {
      uuid: document.uuid,
      id: document.id,
      kind,
      name: document.name ?? "",
      img: this.#resolveImg(kind, document),
      document,
      ambiguous: false
    };
  }

  /**
   * @param {EntityKind} kind
   * @param {foundry.abstract.Document} document
   * @returns {string}
   */
  static #resolveImg(kind, document) {
    const fallback =
      (kind === "actor" && Actor?.DEFAULT_ICON) ||
      (kind === "item" && (CONFIG.Item?.documentClass?.DEFAULT_ICON || "icons/svg/item-bag.svg")) ||
      (kind === "scene" && "icons/svg/homeland.svg") ||
      (kind === "journal" && JournalEntry?.DEFAULT_ICON) ||
      (kind === "rollTable" && RollTable?.DEFAULT_ICON) ||
      "icons/svg/mystery-man.svg";

    if (kind === "scene") {
      return document.thumbnail || document.thumb || fallback;
    }

    return document.img || fallback;
  }
}
