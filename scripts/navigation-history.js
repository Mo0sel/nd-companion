/**
 * Lightweight browser-style back/forward stack for Relationship Explorer hops.
 * Does not persist. Caps length to keep navigation responsive.
 */
export class NavigationHistory {
  /** @type {Array<{ kind: string, id: string, label: string }>} */
  static #past = [];

  /** @type {Array<{ kind: string, id: string, label: string }>} */
  static #future = [];

  /** @type {{ kind: string, id: string, label: string }|null} */
  static #current = null;

  static #max = 24;

  /** @returns {{ kind: string, id: string, label: string }|null} */
  static current() {
    return NavigationHistory.#current
      ? { ...NavigationHistory.#current }
      : null;
  }

  /** @returns {boolean} */
  static canBack() {
    return NavigationHistory.#past.length > 0;
  }

  /** @returns {boolean} */
  static canForward() {
    return NavigationHistory.#future.length > 0;
  }

  /**
   * Trail ending with the current location (for breadcrumbs).
   * @returns {Array<{ kind: string, id: string, label: string }>}
   */
  static trail() {
    const trail = NavigationHistory.#past.map((entry) => ({ ...entry }));
    if (NavigationHistory.#current) trail.push({ ...NavigationHistory.#current });
    return trail;
  }

  /**
   * Record that we are leaving `from` and arriving at `to`.
   * @param {{ kind: string, id: string, label?: string }|null} from
   * @param {{ kind: string, id: string, label?: string }} to
   */
  static navigate(from, to) {
    if (!to?.kind || !to?.id) return;
    const next = NavigationHistory.#normalize(to);
    const sameCurrent =
      NavigationHistory.#current &&
      NavigationHistory.#current.kind === next.kind &&
      NavigationHistory.#current.id === next.id;
    if (sameCurrent) {
      NavigationHistory.#current = next;
      return;
    }

    const leave = from && from.kind && from.id
      ? NavigationHistory.#normalize(from)
      : NavigationHistory.#current;
    if (
      leave &&
      !(leave.kind === next.kind && leave.id === next.id)
    ) {
      const top = NavigationHistory.#past.at(-1);
      if (!(top && top.kind === leave.kind && top.id === leave.id)) {
        NavigationHistory.#past.push(leave);
      }
      if (NavigationHistory.#past.length > NavigationHistory.#max) {
        NavigationHistory.#past.shift();
      }
    }
    NavigationHistory.#current = next;
    NavigationHistory.#future = [];
  }

  /**
   * Keep the current crumb label in sync when the same entity is re-painted.
   * Does not create history entries — relationship hops call navigate().
   * @param {{ kind: string, id: string, label?: string }|null} target
   */
  static syncCurrent(target) {
    if (!target?.kind || !target?.id) return;
    const next = NavigationHistory.#normalize(target);
    if (
      NavigationHistory.#current &&
      NavigationHistory.#current.kind === next.kind &&
      NavigationHistory.#current.id === next.id
    ) {
      NavigationHistory.#current = next;
      return;
    }
    // Sidebar / explorer selection: align the tip without stacking.
    if (NavigationHistory.#current) {
      NavigationHistory.#current = next;
      NavigationHistory.#future = [];
      return;
    }
    NavigationHistory.#current = next;
  }

  /** @returns {{ kind: string, id: string, label: string }|null} */
  static back() {
    if (!NavigationHistory.#past.length) return null;
    if (NavigationHistory.#current) {
      NavigationHistory.#future.unshift(NavigationHistory.#current);
    }
    NavigationHistory.#current = NavigationHistory.#past.pop() ?? null;
    return NavigationHistory.current();
  }

  /** @returns {{ kind: string, id: string, label: string }|null} */
  static forward() {
    if (!NavigationHistory.#future.length) return null;
    if (NavigationHistory.#current) {
      NavigationHistory.#past.push(NavigationHistory.#current);
    }
    NavigationHistory.#current = NavigationHistory.#future.shift() ?? null;
    return NavigationHistory.current();
  }

  /**
   * Jump to a breadcrumb index (0-based within trail()).
   * @param {number} index
   * @returns {{ kind: string, id: string, label: string }|null}
   */
  static jumpTo(index) {
    const trail = NavigationHistory.trail();
    if (!Number.isInteger(index) || index < 0 || index >= trail.length) return null;
    if (index === trail.length - 1) return NavigationHistory.current();

    const target = trail[index];
    const after = trail.slice(index + 1);
    NavigationHistory.#past = trail.slice(0, index);
    NavigationHistory.#current = { ...target };
    NavigationHistory.#future = after;
    return NavigationHistory.current();
  }

  static clear() {
    NavigationHistory.#past = [];
    NavigationHistory.#future = [];
    NavigationHistory.#current = null;
  }

  static #normalize(entry) {
    return {
      kind: entry.kind,
      id: entry.id,
      label: typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : "Untitled"
    };
  }
}
