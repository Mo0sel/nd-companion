import { EntityRegistry } from "./entity-registry.js";
import { Navigation } from "./navigation.js";

/**
 * Shared Playbook entity presentation helpers (EntityRegistry only).
 */
export class PlaybookEntities {
  /**
   * Label for select options: "Name" or "Name (Folder / Path)".
   * @param {import("./entity-registry.js").RegistryEntity} entity
   * @returns {string}
   */
  static choiceLabel(entity) {
    if (!entity) return "";
    const context = PlaybookEntities.secondaryContext(entity);
    return context ? `${entity.name} (${context})` : entity.name;
  }

  /**
   * Folder path when available; otherwise actor type label.
   * @param {import("./entity-registry.js").RegistryEntity} entity
   * @returns {string}
   */
  static secondaryContext(entity) {
    if (!entity?.document) return "";

    const folderPath = PlaybookEntities.#folderPath(entity.document);
    if (folderPath) return folderPath;

    if (entity.kind === "actor") {
      const typeLabel =
        CONFIG.Actor?.typeLabels?.[entity.document.type] ?? entity.document.type;
      return typeLabel ? game.i18n.localize(typeLabel) : "";
    }

    return "";
  }

  /**
   * @param {string|null|undefined} uuid
   * @returns {{ uuid: string, name: string, kind: string|null, context: string, navigable: boolean, missing: boolean }|null}
   */
  static resolveChip(uuid) {
    if (!uuid) return null;
    const entity = EntityRegistry.findByUUID(uuid);
    if (!entity) {
      return {
        uuid,
        name: "Missing entity",
        kind: null,
        context: "",
        navigable: false,
        missing: true
      };
    }

    return {
      uuid: entity.uuid,
      name: entity.name,
      kind: entity.kind,
      context: PlaybookEntities.secondaryContext(entity),
      navigable: Navigation.canNavigate(entity),
      missing: false
    };
  }

  /**
   * @param {string[]} uuids
   * @returns {ReturnType<typeof PlaybookEntities.resolveChip>[]}
   */
  static resolveChips(uuids) {
    if (!Array.isArray(uuids)) return [];
    return uuids.map((uuid) => PlaybookEntities.resolveChip(uuid)).filter(Boolean);
  }

  /**
   * @param {HTMLElement} container
   * @param {string[]} uuids
   * @param {{ removable?: boolean }} [options]
   */
  static paintChips(container, uuids, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();

    for (const chip of PlaybookEntities.resolveChips(uuids)) {
      container.append(PlaybookEntities.#createChip(chip, options));
    }
  }

  /**
   * @param {HTMLElement} container
   * @param {string|null} uuid
   * @param {{ removable?: boolean }} [options]
   */
  static paintSceneChip(container, uuid, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();
    const chip = PlaybookEntities.resolveChip(uuid);
    if (!chip) return;
    container.append(PlaybookEntities.#createChip(chip, options));
  }

  /**
   * Sorted EntityRegistry entities for a kind.
   * @param {"actor"|"scene"|"journal"|"rollTable"} kind
   * @returns {import("./entity-registry.js").RegistryEntity[]}
   */
  static choices(kind) {
    return EntityRegistry.all(kind).sort((a, b) =>
      a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: "base" })
    );
  }

  /**
   * @param {ReturnType<typeof PlaybookEntities.resolveChip>} chip
   * @param {{ removable?: boolean }} options
   * @returns {HTMLElement}
   */
  static #createChip(chip, options) {
    const kindClass = chip.kind ? `nd-chip--${chip.kind}` : "nd-chip--actor";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `nd-playbook__entity nd-chip ${kindClass}`;
    button.textContent = chip.name;
    if (chip.context) button.title = chip.context;

    if (chip.navigable && !chip.missing) {
      button.classList.add("nd-playbook__entity--navigable", "nd-chip--navigable");
      button.dataset.playbookEntity = chip.uuid;
    } else {
      button.classList.add("nd-playbook__entity--disabled", "nd-chip--disabled");
      button.setAttribute("aria-disabled", "true");
      button.title = chip.missing ? "Missing from this world" : chip.context || "Cannot navigate";
    }

    if (!options.removable) return button;

    const wrap = document.createElement("span");
    wrap.className = "nd-playbook__entity-wrap";
    button.classList.add("nd-playbook__entity--with-remove");
    wrap.append(button);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nd-playbook__entity-remove";
    remove.dataset.playbookRemoveEntity = chip.uuid;
    remove.setAttribute("aria-label", `Remove ${chip.name}`);
    remove.textContent = "×";
    wrap.append(remove);

    return wrap;
  }

  /**
   * @param {foundry.abstract.Document} document
   * @returns {string}
   */
  static #folderPath(document) {
    const parts = [];
    let folder = document.folder;
    if (typeof folder === "string") folder = game.folders?.get(folder) ?? null;

    let guard = 0;
    while (folder && guard < 20) {
      parts.unshift(folder.name);
      const parent = folder.folder;
      folder = typeof parent === "string" ? game.folders?.get(parent) ?? null : parent ?? null;
      guard += 1;
    }

    return parts.join(" / ");
  }
}
