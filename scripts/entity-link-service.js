import { CompanionStorage } from "./storage.js";

/**
 * Undirected companion-side links for pairs that cannot live on campaign
 * document related* arrays (e.g. Actor ↔ Actor).
 * Not a new campaign concept — persistence for existing Connected Knowledge.
 */
export class EntityLinkService {
  /**
   * @returns {{ aKind: string, aId: string, bKind: string, bId: string }[]}
   */
  static list() {
    return CompanionStorage.getEntityLinks();
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @returns {Promise<boolean>}
   */
  static async add(left, right) {
    if (!left?.kind || !left?.id || !right?.kind || !right?.id) return false;
    if (left.kind === right.kind && left.id === right.id) return false;
    const links = CompanionStorage.getEntityLinks();
    if (EntityLinkService.#has(links, left, right)) return true;
    const [a, b] = EntityLinkService.#ordered(left, right);
    links.push({
      aKind: a.kind,
      aId: a.id,
      bKind: b.kind,
      bId: b.id
    });
    await CompanionStorage.setEntityLinks(links);
    return true;
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @returns {Promise<boolean>}
   */
  static async remove(left, right) {
    const links = CompanionStorage.getEntityLinks();
    const next = links.filter((link) => !EntityLinkService.#matches(link, left, right));
    if (next.length === links.length) return false;
    await CompanionStorage.setEntityLinks(next);
    return true;
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   */
  static has(left, right) {
    return EntityLinkService.#has(CompanionStorage.getEntityLinks(), left, right);
  }

  /**
   * Neighbors of one entity from the link store.
   * @param {{ kind: string, id: string }} entity
   * @returns {{ kind: string, id: string }[]}
   */
  static neighbors(entity) {
    if (!entity?.kind || !entity?.id) return [];
    const out = [];
    for (const link of CompanionStorage.getEntityLinks()) {
      if (link.aKind === entity.kind && link.aId === entity.id) {
        out.push({ kind: link.bKind, id: link.bId });
      } else if (link.bKind === entity.kind && link.bId === entity.id) {
        out.push({ kind: link.aKind, id: link.aId });
      }
    }
    return out;
  }

  /**
   * Drop every link that references a deleted entity.
   * @param {{ kind: string, id: string }} entity
   * @returns {Promise<number>} removed count
   */
  static async purgeEntity(entity) {
    if (!entity?.kind || !entity?.id) return 0;
    const links = CompanionStorage.getEntityLinks();
    const next = links.filter(
      (link) =>
        !(link.aKind === entity.kind && link.aId === entity.id) &&
        !(link.bKind === entity.kind && link.bId === entity.id)
    );
    const removed = links.length - next.length;
    if (removed) await CompanionStorage.setEntityLinks(next);
    return removed;
  }

  static #has(links, left, right) {
    return links.some((link) => EntityLinkService.#matches(link, left, right));
  }

  static #matches(link, left, right) {
    return (
      (link.aKind === left.kind && link.aId === left.id &&
        link.bKind === right.kind && link.bId === right.id) ||
      (link.aKind === right.kind && link.aId === right.id &&
        link.bKind === left.kind && link.bId === left.id)
    );
  }

  static #ordered(left, right) {
    const leftKey = `${left.kind}:${left.id}`;
    const rightKey = `${right.kind}:${right.id}`;
    return leftKey < rightKey ? [left, right] : [right, left];
  }
}
