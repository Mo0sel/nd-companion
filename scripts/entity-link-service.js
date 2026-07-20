import { RelationshipService } from "./relationship-service.js";

/**
 * Compatibility facade over RelationshipService.
 * Undirected companion-side links for pairs that cannot live on campaign
 * document related* arrays (e.g. Actor ↔ Actor).
 */
export class EntityLinkService {
  /**
   * @returns {{ aKind: string, aId: string, bKind: string, bId: string }[]}
   */
  static list() {
    return RelationshipService.list().map((rel) => ({
      aKind: rel.sourceType,
      aId: rel.sourceId,
      bKind: rel.targetType,
      bId: rel.targetId
    }));
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @returns {Promise<boolean>}
   */
  static async add(left, right) {
    const created = await RelationshipService.connect(left, right);
    return Boolean(created);
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   * @returns {Promise<boolean>}
   */
  static async remove(left, right) {
    return RelationshipService.disconnect(left, right);
  }

  /**
   * @param {{ kind: string, id: string }} left
   * @param {{ kind: string, id: string }} right
   */
  static has(left, right) {
    return RelationshipService.has(left, right);
  }

  /**
   * @param {{ kind: string, id: string }} entity
   * @returns {{ kind: string, id: string }[]}
   */
  static neighbors(entity) {
    return RelationshipService.neighbors(entity).map((node) => ({
      kind: node.kind,
      id: node.id
    }));
  }

  /**
   * @param {{ kind: string, id: string }} entity
   * @returns {Promise<number>}
   */
  static async purgeEntity(entity) {
    return RelationshipService.purgeEntity(entity);
  }
}
