import { EntityRegistry } from "./entity-registry.js";
import { FocusManager } from "./focus-manager.js";

/** @typedef {import("./entity-registry.js").RegistryEntity} RegistryEntity */

/**
 * @typedef {{
 *   status: "token_controlled" | "logical_focus" | "scene_viewed" | "sheet_opened" | "failed",
 *   kind: "actor" | "scene" | "journal" | "rollTable",
 *   reason?: string
 * }} NavigationResult
 */

export class Navigation {
  /**
   * @param {RegistryEntity} entity
   * @returns {boolean}
   */
  static canNavigate(entity) {
    const document = Navigation.#resolveDocument(entity);
    if (!document || !entity?.kind) return false;

    switch (entity.kind) {
      case "actor":
        return Navigation.#canNavigateActor(document);
      case "scene":
        return Navigation.#canNavigateScene(document);
      case "journal":
      case "rollTable":
        return Navigation.#canNavigateSheet(document);
      default:
        return false;
    }
  }

  /**
   * @param {RegistryEntity} entity
   * @returns {Promise<NavigationResult>}
   */
  static async navigate(entity) {
    const kind = entity?.kind ?? "actor";

    if (!Navigation.canNavigate(entity)) {
      return { status: "failed", kind, reason: "not_navigable" };
    }

    const document = Navigation.#resolveDocument(entity);
    if (!document) {
      return { status: "failed", kind, reason: "missing_document" };
    }

    switch (entity.kind) {
      case "actor":
        return Navigation.#navigateActor(document);
      case "scene":
        return Navigation.#navigateScene(document);
      case "journal":
      case "rollTable":
        return Navigation.#navigateSheet(document, entity.kind);
      default:
        return { status: "failed", kind, reason: "unsupported_kind" };
    }
  }

  /**
   * @param {RegistryEntity|null|undefined} entity
   * @returns {foundry.abstract.Document|null}
   */
  static #resolveDocument(entity) {
    if (!entity?.uuid || !entity.kind) return null;

    const document = entity.document;
    if (document?.uuid === entity.uuid && document.collection?.has(document.id)) {
      return document;
    }

    return EntityRegistry.findByUUID(entity.uuid)?.document ?? null;
  }

  /**
   * @param {foundry.documents.Actor} actor
   * @returns {boolean}
   */
  static #canNavigateActor(actor) {
    return Boolean(actor?.uuid && game.actors?.has(actor.id));
  }

  /**
   * @param {foundry.documents.Scene} scene
   * @returns {boolean}
   */
  static #canNavigateScene(scene) {
    return Boolean(scene?.uuid && game.scenes?.has(scene.id) && scene.testUserPermission(game.user, "OBSERVER"));
  }

  /**
   * @param {foundry.abstract.Document} document
   * @returns {boolean}
   */
  static #canNavigateSheet(document) {
    return Boolean(document?.uuid && document.collection?.has(document.id) && document.testUserPermission(game.user, "LIMITED"));
  }

  /**
   * @param {foundry.documents.Actor} actor
   * @returns {Promise<NavigationResult>}
   */
  static async #navigateActor(actor) {
    const tokens = actor.getActiveTokens(false, false);

    if (tokens.length > 0) {
      for (const token of Navigation.#orderTokens(tokens, actor)) {
        if (token.control({ releaseOthers: true, pan: true })) {
          return { status: "token_controlled", kind: "actor" };
        }
      }
    }

    FocusManager.setLogicalFocus(actor.uuid);
    return { status: "logical_focus", kind: "actor" };
  }

  /**
   * @param {foundry.documents.Scene} scene
   * @returns {Promise<NavigationResult>}
   */
  static async #navigateScene(scene) {
    try {
      await scene.view();
      return { status: "scene_viewed", kind: "scene" };
    } catch (_error) {
      return { status: "failed", kind: "scene", reason: "scene_view_denied" };
    }
  }

  /**
   * @param {foundry.abstract.Document} document
   * @param {"journal"|"rollTable"} kind
   * @returns {Promise<NavigationResult>}
   */
  static async #navigateSheet(document, kind) {
    try {
      await document.sheet.render(true);
      document.sheet.bringToFront();
      return { status: "sheet_opened", kind };
    } catch (_error) {
      return { status: "failed", kind, reason: "sheet_denied" };
    }
  }

  /**
   * Prefer an already-controlled token for this actor, then remaining scene tokens.
   * @param {(foundry.canvas.placeables.Token|foundry.documents.TokenDocument)[]} tokens
   * @param {foundry.documents.Actor} actor
   * @returns {(foundry.canvas.placeables.Token|foundry.documents.TokenDocument)[]}
   */
  static #orderTokens(tokens, actor) {
    const controlled = canvas?.tokens?.controlled ?? [];
    /** @type {typeof tokens} */
    const ordered = [];

    for (const token of tokens) {
      if (controlled.includes(token)) ordered.push(token);
    }

    for (const token of tokens) {
      if (token.actor?.id === actor.id && !ordered.includes(token)) ordered.push(token);
    }

    for (const token of tokens) {
      if (!ordered.includes(token)) ordered.push(token);
    }

    return ordered;
  }
}
