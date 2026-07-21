/**
 * Focus chrome was removed with the Actors workspace (v0.3.24).
 * FocusManager behavior is unchanged; this paint is intentionally a no-op.
 */
export class FocusPanel {
  /**
   * Build a storage key for document-scoped DM Notes (campaignMemory).
   * @param {"actor"|"scene"|"journal"|"item"} kind
   * @param {string} uuid
   * @returns {string}
   */
  static memoryKey(kind, uuid) {
    return `${kind}:${uuid}`;
  }

  /**
   * @param {HTMLElement} _root
   * @param {ReturnType<import("./focus-manager.js").FocusManager["get"]>} _model
   */
  static paint(_root, _model) {
    // Actors workspace / Companion Memory UI removed — DM Notes live on Campaign entities.
  }
}
