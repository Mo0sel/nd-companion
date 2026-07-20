/**
 * Relationship type vocabulary (Sprint 40).
 * Stored on Relationship records; not exposed in UI yet.
 */
export const RELATIONSHIP_TYPE = Object.freeze({
  RELATED: "Related",
  KNOWS: "Knows",
  WORKS_FOR: "Works For",
  MEMBER_OF: "Member Of",
  CREATED: "Created",
  OWNS: "Owns",
  CAPTURED: "Captured",
  SEARCHING_FOR: "Searching For",
  ENEMY_OF: "Enemy Of",
  LOCATED_IN: "Located In"
});

/** @type {readonly string[]} */
export const RELATIONSHIP_TYPES = Object.freeze(Object.values(RELATIONSHIP_TYPE));

/**
 * @param {string} [value]
 * @returns {string}
 */
export function normalizeRelationshipType(value) {
  const text = String(value ?? "").trim();
  if (RELATIONSHIP_TYPES.includes(text)) return text;
  return RELATIONSHIP_TYPE.RELATED;
}
