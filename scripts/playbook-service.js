import { CompanionStorage } from "./storage.js";
import { EntityRegistry } from "./entity-registry.js";
import { SessionService } from "./session-service.js";

/**
 * @typedef {object} PlaybookRelatedRef
 * @property {string} name
 * @property {"actor"|"scene"|"journal"|"rollTable"} [kind]
 */

/**
 * @typedef {object} PlaybookBeat
 * @property {string} id
 * @property {string} title
 * @property {string} objective
 * @property {string|null} sceneUuid
 * @property {string[]} keyNpcUuids
 * @property {string} gmNotes
 * @property {string} experience
 * @property {PlaybookRelatedRef[]} related  Reserved for future relationship system — do not migrate/transform
 */

/**
 * @typedef {object} PlaybookDocument
 * @property {number} currentIndex
 * @property {PlaybookBeat[]} beats
 */

/**
 * One-time seed only. Written to an empty world during ready(); never read again at runtime.
 * @type {readonly object[]}
 */
const SAMPLE_BEATS = Object.freeze([
  {
    title: "Arrive at Millhaven",
    objective: "Establish the grain shortage and meet Sister Elara.",
    gmNotes:
      "Let the party hear rumors at the inn before any combat. Elara is earnest, not mysterious.",
    related: [
      { name: "Sister Elara", kind: "actor" },
      { name: "Millhaven Square", kind: "scene" }
    ]
  },
  {
    title: "The Burned Granary",
    objective: "Inspect the ruins and find the scorched ledger fragment.",
    gmNotes:
      "Investigation DC 13 finds boot prints leading toward the docks. Do not rush the Pale Merchant reveal.",
    related: [
      { name: "Millhaven Granary", kind: "scene" },
      { name: "Scorched Ledger", kind: "journal" }
    ]
  },
  {
    title: "Dockside Threats",
    objective: "Confront Edric's enforcers without losing the ledger fragment.",
    gmNotes:
      "Offer fight, talk, or flight. Maren's secret passage is DC 14 Investigation if they stall.",
    related: [
      { name: "Edric", kind: "actor" },
      { name: "Maren", kind: "actor" },
      { name: "Harbor Docks", kind: "scene" },
      { name: "Missing World NPC", kind: "actor" }
    ]
  },
  {
    title: "The Pale Merchant",
    objective: "Learn why the merchant is buying ruined grain at a premium.",
    gmNotes:
      "He never admits sabotage. He will sell information about the Thornwood silence for a favor.",
    related: [
      { name: "Pale Merchant", kind: "actor" },
      { name: "Merchant Ledger", kind: "journal" }
    ]
  },
  {
    title: "Captain Voss's Sextant",
    objective: "Return or recover the stolen navigational sextant.",
    gmNotes:
      "If already returned, skip to Voss's tip about night landings near Ashfeld.",
    related: [
      { name: "Captain Voss", kind: "actor" },
      { name: "Random Encounters", kind: "rollTable" }
    ]
  },
  {
    title: "Thornwood Silence",
    objective: "Discover what silenced the forest scouts.",
    gmNotes:
      "Ambient dread only — no full reveal yet. One strange nest is enough for this beat.",
    related: [
      { name: "Thornwood Edge", kind: "scene" },
      { name: "Scout Report", kind: "journal" }
    ]
  },
  {
    title: "Letter to Ashfeld",
    objective: "Deliver Sister Elara's letter to Ashfeld without interception.",
    gmNotes:
      "Road encounter optional. If the party open the letter, note the seal is genuine.",
    related: [
      { name: "Sister Elara", kind: "actor" },
      { name: "Ashfeld Road", kind: "scene" }
    ]
  }
]);

/**
 * Single source of Playbook data. Persists via CompanionStorage.
 * Sample beats seed empty worlds once; runtime reads only the stored document.
 */
export class PlaybookService {
  /** @type {PlaybookDocument} */
  static #doc = { currentIndex: 0, beats: [] };

  /**
   * Load from world storage. Seed sample beats only when beats are empty.
   * After that, SAMPLE_BEATS is never read again.
   * @returns {Promise<void>}
   */
  static async ready() {
    const stored = CompanionStorage.getPlaybook();
    const beats = Array.isArray(stored?.beats) ? stored.beats : [];

    if (beats.length === 0) {
      PlaybookService.#doc = {
        currentIndex: 2,
        beats: SAMPLE_BEATS.map((beat) => PlaybookService.#normalizeBeat(beat))
      };
      await CompanionStorage.setPlaybook(PlaybookService.#doc);
      return;
    }

    PlaybookService.#doc = PlaybookService.#normalize(stored);
    await CompanionStorage.setPlaybook(PlaybookService.#doc);
  }

  /**
   * @returns {PlaybookDocument}
   */
  static getDocument() {
    return {
      currentIndex: PlaybookService.#doc.currentIndex,
      beats: PlaybookService.#doc.beats.map((beat) => PlaybookService.#cloneBeat(beat))
    };
  }

  /**
   * @returns {{
   *   index: number,
   *   total: number,
   *   canPrevious: boolean,
   *   canNext: boolean,
   *   beat: PlaybookBeat
   * }}
   */
  static getCurrent() {
    const total = PlaybookService.#doc.beats.length;
    const index = PlaybookService.#clampIndex(PlaybookService.#doc.currentIndex);
    PlaybookService.#doc.currentIndex = index;
    return {
      index,
      total,
      canPrevious: index > 0,
      canNext: index < total - 1,
      beat: PlaybookService.#cloneBeat(PlaybookService.#doc.beats[index] ?? PlaybookService.#emptyBeat())
    };
  }

  /**
   * @param {number} [index]
   * @returns {PlaybookBeat|null}
   */
  static getBeat(index) {
    const i = index === undefined ? PlaybookService.#doc.currentIndex : index;
    const beat = PlaybookService.#doc.beats[i];
    return beat ? PlaybookService.#cloneBeat(beat) : null;
  }

  /** @returns {number} */
  static getIndex() {
    return PlaybookService.#clampIndex(PlaybookService.#doc.currentIndex);
  }

  /** @returns {number} */
  static getTotal() {
    return PlaybookService.#doc.beats.length;
  }

  /**
   * @returns {{ index: number, title: string, isCurrent: boolean }[]}
   */
  static listBeats() {
    const current = PlaybookService.getIndex();
    return PlaybookService.#doc.beats.map((beat, index) => ({
      index,
      title: beat.title?.trim() ? beat.title : "Untitled Beat",
      isCurrent: index === current
    }));
  }

  /**
   * @returns {Promise<boolean>}
   */
  static async previous() {
    const index = PlaybookService.getIndex();
    if (index <= 0) return false;
    return PlaybookService.setCurrentIndex(index - 1);
  }

  /**
   * @returns {Promise<boolean>}
   */
  static async next() {
    const index = PlaybookService.getIndex();
    if (index >= PlaybookService.getTotal() - 1) return false;
    return PlaybookService.setCurrentIndex(index + 1);
  }

  /**
   * Updates Viewer currentIndex. Does not change Prepare edit selection.
   * @param {number} index
   * @returns {Promise<boolean>}
   */
  static async setCurrentIndex(index) {
    if (!Number.isInteger(index)) return false;
    if (index < 0 || index >= PlaybookService.#doc.beats.length) return false;
    if (PlaybookService.#doc.currentIndex === index) return true;
    PlaybookService.#doc.currentIndex = index;
    await PlaybookService.#persist();
    return true;
  }

  /**
   * @param {number} index
   * @param {{
   *   title?: string,
   *   objective?: string,
   *   sceneUuid?: string|null,
   *   keyNpcUuids?: string[],
   *   gmNotes?: string,
   *   experience?: string
   * }} patch
   * @returns {Promise<boolean>}
   */
  static async updateBeat(index, patch) {
    const beat = PlaybookService.#doc.beats[index];
    if (!beat || !patch) return false;

    if (typeof patch.title === "string") beat.title = patch.title;
    if (typeof patch.objective === "string") beat.objective = patch.objective;
    if (typeof patch.gmNotes === "string") beat.gmNotes = patch.gmNotes;
    if (typeof patch.experience === "string") beat.experience = patch.experience;
    if ("sceneUuid" in patch) {
      beat.sceneUuid = PlaybookService.#normalizeSceneUuid(patch.sceneUuid);
    }
    if (Array.isArray(patch.keyNpcUuids)) {
      beat.keyNpcUuids = PlaybookService.#normalizeActorUuids(patch.keyNpcUuids);
    }

    await PlaybookService.#persist();
    return true;
  }

  /**
   * Append an empty beat and persist.
   * @returns {Promise<number>} New beat index
   */
  static async addBeat() {
    PlaybookService.#doc.beats.push(PlaybookService.#emptyBeat());
    const index = PlaybookService.#doc.beats.length - 1;
    await PlaybookService.#persist();
    return index;
  }

  /**
   * Remove a beat and clamp currentIndex.
   * @param {number} index
   * @returns {Promise<{ ok: boolean, nextEditIndex: number|null }>}
   */
  static async deleteBeat(index) {
    if (!Number.isInteger(index) || index < 0 || index >= PlaybookService.#doc.beats.length) {
      return { ok: false, nextEditIndex: PlaybookService.getTotal() ? PlaybookService.getIndex() : null };
    }

    PlaybookService.#doc.beats.splice(index, 1);

    if (PlaybookService.#doc.beats.length === 0) {
      PlaybookService.#doc.currentIndex = 0;
      await PlaybookService.#persist();
      return { ok: true, nextEditIndex: null };
    }

    if (PlaybookService.#doc.currentIndex > index) {
      PlaybookService.#doc.currentIndex -= 1;
    } else if (PlaybookService.#doc.currentIndex >= PlaybookService.#doc.beats.length) {
      PlaybookService.#doc.currentIndex = PlaybookService.#doc.beats.length - 1;
    }

    await PlaybookService.#persist();
    return {
      ok: true,
      nextEditIndex: Math.min(index, PlaybookService.#doc.beats.length - 1)
    };
  }

  static async #persist() {
    await CompanionStorage.setPlaybook({
      currentIndex: PlaybookService.#doc.currentIndex,
      beats: PlaybookService.#doc.beats.map((beat) => PlaybookService.#cloneBeat(beat))
    });
    await PlaybookService.#syncSessionBeatIds();
  }

  /**
   * Keep active Session.beatIds aligned with playbook order.
   * Ownership is by id only — beats are not nested in the Session.
   */
  static async #syncSessionBeatIds() {
    const beatIds = PlaybookService.#doc.beats
      .map((beat) => beat.id)
      .filter((id) => typeof id === "string" && id);
    await SessionService.syncActiveBeatIds(beatIds);
  }

  /**
   * @param {unknown} stored
   * @returns {PlaybookDocument}
   */
  static #normalize(stored) {
    const beats = Array.isArray(stored?.beats)
      ? stored.beats.map((beat) => PlaybookService.#normalizeBeat(beat))
      : [];
    const currentIndex = PlaybookService.#clampIndex(Number(stored?.currentIndex) || 0, beats.length);
    return { currentIndex, beats };
  }

  /**
   * @param {unknown} beat
   * @returns {PlaybookBeat}
   */
  static #normalizeBeat(beat) {
    // related[] is reserved — copy only, never migrate into scene/characters
    const related = Array.isArray(beat?.related)
      ? beat.related
          .filter((ref) => ref && typeof ref.name === "string")
          .map((ref) => ({
            name: ref.name,
            ...(ref.kind ? { kind: ref.kind } : {})
          }))
      : [];

    let sceneUuid = PlaybookService.#normalizeSceneUuid(beat?.sceneUuid);
    if (!sceneUuid && typeof beat?.scene === "string" && beat.scene.trim()) {
      sceneUuid = PlaybookService.#migrateNameToUuid(beat.scene.trim(), "scene");
    }

    let keyNpcUuids = Array.isArray(beat?.keyNpcUuids)
      ? PlaybookService.#normalizeActorUuids(beat.keyNpcUuids)
      : [];

    if (keyNpcUuids.length === 0 && typeof beat?.keyNpcs === "string" && beat.keyNpcs.trim()) {
      keyNpcUuids = PlaybookService.#migrateKeyNpcsText(beat.keyNpcs);
    }

    return {
      id:
        typeof beat?.id === "string" && beat.id.trim()
          ? beat.id.trim()
          : foundry.utils.randomID(),
      title: typeof beat?.title === "string" ? beat.title : "",
      objective: typeof beat?.objective === "string" ? beat.objective : "",
      sceneUuid,
      keyNpcUuids,
      gmNotes: typeof beat?.gmNotes === "string" ? beat.gmNotes : "",
      experience: typeof beat?.experience === "string" ? beat.experience : "",
      related
    };
  }

  /**
   * @param {PlaybookBeat} beat
   * @returns {PlaybookBeat}
   */
  static #cloneBeat(beat) {
    return {
      id: beat.id ?? foundry.utils.randomID(),
      title: beat.title ?? "",
      objective: beat.objective ?? "",
      sceneUuid: beat.sceneUuid ?? null,
      keyNpcUuids: [...(beat.keyNpcUuids ?? [])],
      gmNotes: beat.gmNotes ?? "",
      experience: beat.experience ?? "",
      related: (beat.related ?? []).map((ref) => ({
        name: ref.name,
        ...(ref.kind ? { kind: ref.kind } : {})
      }))
    };
  }

  /** @returns {PlaybookBeat} */
  static #emptyBeat() {
    return {
      id: foundry.utils.randomID(),
      title: "",
      objective: "",
      sceneUuid: null,
      keyNpcUuids: [],
      gmNotes: "",
      experience: "",
      related: []
    };
  }

  /**
   * @param {unknown} value
   * @returns {string|null}
   */
  static #normalizeSceneUuid(value) {
    if (!value || typeof value !== "string") return null;
    const entity = EntityRegistry.findByUUID(value);
    return entity?.kind === "scene" ? entity.uuid : null;
  }

  /**
   * @param {unknown[]} values
   * @returns {string[]}
   */
  static #normalizeActorUuids(values) {
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    for (const value of values) {
      if (typeof value !== "string" || !value) continue;
      const entity = EntityRegistry.findByUUID(value);
      if (entity?.kind !== "actor") continue;
      if (seen.has(entity.uuid)) continue;
      seen.add(entity.uuid);
      out.push(entity.uuid);
    }
    return out;
  }

  /**
   * @param {string} name
   * @param {"actor"|"scene"} kind
   * @returns {string|null}
   */
  static #migrateNameToUuid(name, kind) {
    const byUuid = EntityRegistry.findByUUID(name);
    if (byUuid?.kind === kind) return byUuid.uuid;

    const result = EntityRegistry.findByName(name, kind);
    return result.status === "ok" ? result.entity.uuid : null;
  }

  /**
   * @param {string} text
   * @returns {string[]}
   */
  static #migrateKeyNpcsText(text) {
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    for (const part of text.split(/[\n,;]+/)) {
      const name = part.trim();
      if (!name) continue;
      const uuid = PlaybookService.#migrateNameToUuid(name, "actor");
      if (!uuid || seen.has(uuid)) continue;
      seen.add(uuid);
      out.push(uuid);
    }
    return out;
  }

  /**
   * @param {number} index
   * @param {number} [total]
   * @returns {number}
   */
  static #clampIndex(index, total = PlaybookService.#doc.beats.length) {
    if (total <= 0) return 0;
    if (!Number.isFinite(index)) return 0;
    return Math.min(Math.max(Math.trunc(index), 0), total - 1);
  }
}
