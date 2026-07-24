/**
 * Sessions browser — chronicle / session history.
 */

import { SessionService } from "./session-service.js";

export class SessionsBrowserPanel {
  /**
   * @param {HTMLElement} container
   * @param {{ onOpen?: (sessionId: string) => void }} [options]
   */
  static paint(container, options = {}) {
    if (!(container instanceof HTMLElement)) return;
    const sessions = SessionService.list()
      .slice()
      .sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0));

    const root = document.createElement("div");
    root.className = "nd-sessions-browser";
    const header = document.createElement("header");
    header.className = "nd-sessions-browser__header";
    header.innerHTML = `<h2>Sessions</h2><p>${sessions.length} recorded</p>`;
    root.append(header);

    const list = document.createElement("div");
    list.className = "nd-sessions-browser__list";
    if (!sessions.length) {
      const empty = document.createElement("p");
      empty.textContent = "No sessions yet.";
      list.append(empty);
    } else {
      for (const session of sessions) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "nd-sessions-browser__row";
        row.innerHTML = `
          <span>Session ${session.sessionNumber}${session.title ? ` · ${session.title}` : ""}</span>
          <span class="nd-sessions-browser__status">${session.status}</span>
        `;
        row.addEventListener("click", () => options.onOpen?.(session.id));
        list.append(row);
      }
    }
    root.append(list);
    container.replaceChildren(root);
  }
}
