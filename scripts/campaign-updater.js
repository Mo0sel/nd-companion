/**
 * CampaignUpdater — sole write layer for AI-approved campaign mutations.
 * Session history is append-only: completed sessions are never overwritten.
 */

import { CampaignDocument } from "./campaign-document.js";
import { QuestEntryService } from "./quest-entry-service.js";
import { SessionService } from "./session-service.js";
import { StoryThreadService } from "./story-thread-service.js";
import { CompanionStorage } from "./storage.js";

/**
 * @typedef {object} WrapUpProposal
 * @property {string} [sessionSummary]
 * @property {string[]} [timelineEvents]
 * @property {object[]} [questUpdates]
 * @property {object[]} [newNPCs]
 * @property {object[]} [npcChanges]
 * @property {object[]} [locationUpdates]
 * @property {object[]} [storyThreads]
 * @property {string[]} [playerDecisions]
 * @property {string[]} [futureHooks]
 * @property {string[]} [recommendedPrep]
 */

/**
 * @typedef {object} WrapUpApprovals
 * @property {boolean} sessionSummary
 * @property {boolean} timelineEvents
 * @property {boolean} questUpdates
 * @property {boolean} newNPCs
 * @property {boolean} npcChanges
 * @property {boolean} locationUpdates
 * @property {boolean} storyThreads
 * @property {boolean} playerDecisions
 * @property {boolean} futureHooks
 * @property {boolean} recommendedPrep
 */

export class CampaignUpdater {
  /**
   * Validate / normalize AI JSON into a safe proposal object.
   * @param {unknown} raw
   * @returns {{ ok: true, proposal: WrapUpProposal }|{ ok: false, error: string }}
   */
  static validateProposal(raw) {
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch (_error) {
        return { ok: false, error: "Wrap-up response is not valid JSON." };
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "Wrap-up payload must be a JSON object." };
    }

    /** @type {WrapUpProposal} */
    const proposal = {
      sessionSummary: CampaignUpdater.#string(data.sessionSummary),
      timelineEvents: CampaignUpdater.#stringList(data.timelineEvents),
      questUpdates: CampaignUpdater.#objectList(data.questUpdates),
      newNPCs: CampaignUpdater.#objectList(data.newNPCs),
      npcChanges: CampaignUpdater.#objectList(data.npcChanges),
      locationUpdates: CampaignUpdater.#objectList(data.locationUpdates),
      storyThreads: CampaignUpdater.#objectList(data.storyThreads),
      playerDecisions: CampaignUpdater.#stringList(data.playerDecisions),
      futureHooks: CampaignUpdater.#stringList(data.futureHooks),
      recommendedPrep: CampaignUpdater.#stringList(data.recommendedPrep)
    };
    return { ok: true, proposal };
  }

  /**
   * Apply only approved sections. Archives the session afterward (append-only).
   * @param {{
   *   proposal: WrapUpProposal,
   *   approvals: WrapUpApprovals,
   *   edited?: WrapUpProposal
   * }} input
   * @returns {Promise<{ archived: object, next: object, applied: string[] }|null>}
   */
  static async applyWrapUp(input) {
    const validated = CampaignUpdater.validateProposal(input.edited ?? input.proposal);
    if (!validated.ok) throw new Error(validated.error);
    const proposal = validated.proposal;
    const approvals = input.approvals ?? {};
    /** @type {string[]} */
    const applied = [];

    const active = SessionService.getActive();
    if (!active) throw new Error("No active session to wrap up.");

    // Build append-only wrap-up record for the session being archived.
    /** @type {object} */
    const wrapUpRecord = {
      createdAt: new Date().toISOString(),
      proposal: foundry.utils.duplicate(proposal),
      approvals: foundry.utils.duplicate(approvals)
    };

    // 1) Append summary / timeline / decisions into the live session log (never wipe).
    if (approvals.sessionSummary || approvals.timelineEvents || approvals.playerDecisions) {
      const blocks = [];
      if (approvals.sessionSummary && proposal.sessionSummary) {
        blocks.push(`## Session Summary\n${proposal.sessionSummary}`);
        applied.push("sessionSummary");
      }
      if (approvals.timelineEvents && proposal.timelineEvents.length) {
        blocks.push(
          `## Timeline Events\n${proposal.timelineEvents.map((line) => `- ${line}`).join("\n")}`
        );
        applied.push("timelineEvents");
      }
      if (approvals.playerDecisions && proposal.playerDecisions.length) {
        blocks.push(
          `## Player Decisions\n${proposal.playerDecisions.map((line) => `- ${line}`).join("\n")}`
        );
        applied.push("playerDecisions");
      }
      if (blocks.length) {
        const existing = String(active.sessionLog ?? "").trim();
        const addition = blocks.join("\n\n").trim();
        const nextLog = existing ? `${existing}\n\n---\n\n${addition}` : addition;
        await SessionService.setActiveSessionLog(nextLog);
      }
    }

    // 2) Quest updates (status / notes) via QuestEntryService only.
    if (approvals.questUpdates) {
      for (const update of proposal.questUpdates) {
        const id = typeof update.id === "string" ? update.id : "";
        if (!id || !QuestEntryService.getById(id)) continue;
        /** @type {Record<string, string>} */
        const patch = {};
        if (typeof update.status === "string") patch.status = update.status;
        if (typeof update.title === "string" && update.title.trim()) patch.title = update.title.trim();
        if (typeof update.notes === "string") {
          const current = QuestEntryService.getById(id);
          const prior = String(current?.notes ?? "").trim();
          const addition = update.notes.trim();
          patch.notes = prior ? `${prior}\n\n${addition}` : addition;
        }
        if (Object.keys(patch).length) {
          await QuestEntryService.update(id, patch);
          applied.push(`quest:${id}`);
        }
      }
    }

    // 3) Story thread updates / creates.
    if (approvals.storyThreads) {
      for (const thread of proposal.storyThreads) {
        const id = typeof thread.id === "string" ? thread.id : "";
        if (id && StoryThreadService.getById(id)) {
          /** @type {Record<string, unknown>} */
          const patch = {};
          if (typeof thread.status === "string") patch.status = thread.status;
          if (typeof thread.currentState === "string") patch.currentState = thread.currentState;
          if (typeof thread.title === "string" && thread.title.trim()) {
            patch.title = thread.title.trim();
          }
          if (typeof thread.note === "string" && thread.note.trim()) {
            const current = StoryThreadService.getById(id);
            const prior = String(current?.description ?? "").trim();
            patch.description = prior
              ? `${prior}\n\n${thread.note.trim()}`
              : thread.note.trim();
          }
          if (Object.keys(patch).length) {
            await StoryThreadService.update(id, patch);
            applied.push(`storyThread:${id}`);
          }
          continue;
        }
        if (typeof thread.title === "string" && thread.title.trim()) {
          const created = await StoryThreadService.create({
            title: thread.title.trim(),
            description: typeof thread.note === "string" ? thread.note : "",
            status: typeof thread.status === "string" ? thread.status : "ACTIVE",
            currentState: typeof thread.currentState === "string" ? thread.currentState : ""
          });
          if (created) applied.push(`storyThread:new:${created.id}`);
        }
      }
    }

    // 4) NPC / location notes — append into campaign memory bag (never wipe).
    if (approvals.npcChanges) {
      for (const change of proposal.npcChanges) {
        const uuid = typeof change.uuid === "string" ? change.uuid : change.id;
        const note = typeof change.note === "string" ? change.note.trim() : "";
        if (!uuid || !note) continue;
        const key = `actor:${uuid}`;
        const prior = String(CompanionStorage.getMemory(key) || "").trim();
        await CompanionStorage.setMemory(key, prior ? `${prior}\n\n${note}` : note);
        applied.push(`npc:${uuid}`);
      }
    }
    if (approvals.newNPCs) {
      // Cannot create Foundry Actors from Companion — store as prep memory notes.
      for (const npc of proposal.newNPCs) {
        const name = typeof npc.name === "string" ? npc.name.trim() : "";
        const note = typeof npc.note === "string" ? npc.note.trim() : "";
        if (!name) continue;
        const key = `wrapup:npc:${name.toLowerCase().replace(/\s+/g, "-")}`;
        const body = [`Proposed NPC: ${name}`, note].filter(Boolean).join("\n");
        const prior = String(CompanionStorage.getMemory(key) || "").trim();
        await CompanionStorage.setMemory(key, prior ? `${prior}\n\n${body}` : body);
        applied.push(`newNpc:${name}`);
      }
    }
    if (approvals.locationUpdates) {
      for (const change of proposal.locationUpdates) {
        const uuid = typeof change.uuid === "string" ? change.uuid : change.id;
        const note = typeof change.note === "string" ? change.note.trim() : "";
        if (!uuid || !note) continue;
        const key = `scene:${uuid}`;
        const prior = String(CompanionStorage.getMemory(key) || "").trim();
        await CompanionStorage.setMemory(key, prior ? `${prior}\n\n${note}` : note);
        applied.push(`location:${uuid}`);
      }
    }

    // 5) Future hooks / prep — append to session notes (then archived with session).
    if (approvals.futureHooks || approvals.recommendedPrep) {
      const blocks = [];
      if (approvals.futureHooks && proposal.futureHooks.length) {
        blocks.push(
          `## Future Hooks\n${proposal.futureHooks.map((line) => `- ${line}`).join("\n")}`
        );
        applied.push("futureHooks");
      }
      if (approvals.recommendedPrep && proposal.recommendedPrep.length) {
        blocks.push(
          `## Recommended Prep\n${proposal.recommendedPrep.map((line) => `- ${line}`).join("\n")}`
        );
        applied.push("recommendedPrep");
      }
      if (blocks.length) {
        const existing = String(SessionService.getActiveNotes() ?? "").trim();
        const addition = blocks.join("\n\n").trim();
        await SessionService.setActiveNotes(
          existing ? `${existing}\n\n---\n\n${addition}` : addition
        );
      }
    }

    // 6) Stamp wrap-up record onto the session (immutable once archived).
    await CampaignDocument.update((doc) => {
      const session = doc.sessions.find((entry) => entry.id === active.id);
      if (!session) return;
      if (!Array.isArray(session.wrapUpHistory)) session.wrapUpHistory = [];
      session.wrapUpHistory.push(wrapUpRecord);
      session.updated = Date.now();
    });

    // 7) Archive session + open next (existing append-only session flow).
    const result = await SessionService.endActiveSession();
    if (!result) throw new Error("Failed to archive the session.");
    return {
      archived: result.archived,
      next: result.next,
      applied
    };
  }

  static #string(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  static #stringList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  static #objectList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }
}
