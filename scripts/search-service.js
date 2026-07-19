/**
 * Provider-based universal campaign search.
 * The search UI depends only on this service, never on campaign domains.
 */
export class SearchService {
  /** @type {Map<string, SearchProvider>} */
  static #providers = new Map();

  /**
   * @param {SearchProvider} provider
   */
  static registerProvider(provider) {
    if (!provider?.id || typeof provider.getItems !== "function") return;
    SearchService.#providers.set(provider.id, provider);
  }

  /**
   * @param {string} query
   * @returns {{ label: string, results: SearchResult[] }[]}
   */
  static search(query) {
    const needle = SearchService.#normalize(query);
    if (!needle) return [];
    const opened = SearchService.#readOpened();
    const groups = new Map();

    for (const provider of SearchService.#providers.values()) {
      for (const item of provider.getItems()) {
        const match = SearchService.#match(needle, item.title);
        if (!match) continue;
        const key = `${provider.id}:${item.id}`;
        const result = {
          key,
          providerId: provider.id,
          id: item.id,
          title: item.title,
          subtitle: item.subtitle ?? "",
          group: item.group || provider.label,
          rank: match.rank,
          score: match.score,
          recentlyOpened: opened[key] ?? 0
        };
        const list = groups.get(result.group) ?? [];
        list.push(result);
        groups.set(result.group, list);
      }
    }

    return [...groups.entries()]
      .map(([label, results]) => ({
        label,
        results: results.sort(SearchService.#compare)
      }))
      .sort((a, b) => SearchService.#compare(a.results[0], b.results[0]));
  }

  /**
   * @returns {SearchResult[]}
   */
  static quickAccess() {
    /** @type {SearchResult[]} */
    const results = [];
    for (const provider of SearchService.#providers.values()) {
      if (typeof provider.getQuickAccess !== "function") continue;
      for (const item of provider.getQuickAccess()) {
        results.push({
          key: `${provider.id}:${item.id}`,
          providerId: provider.id,
          id: item.id,
          title: item.title,
          subtitle: item.subtitle ?? provider.label,
          group: "Quick Access",
          rank: 0,
          score: 0,
          recentlyOpened: 0
        });
      }
    }
    return results;
  }

  /**
   * Navigate through the provider that owns a result.
   * @param {string} key
   * @param {SearchNavigationContext} context
   * @returns {Promise<boolean>}
   */
  static async open(key, context) {
    const separator = key.indexOf(":");
    if (separator < 1) return false;
    const providerId = key.slice(0, separator);
    const id = key.slice(separator + 1);
    const provider = SearchService.#providers.get(providerId);
    if (!provider || typeof provider.open !== "function") return false;
    const opened = await provider.open(id, context);
    if (opened !== false) SearchService.#recordOpened(key);
    return opened !== false;
  }

  /**
   * @param {string} query
   */
  static recordSearch(query) {
    const value = String(query ?? "").trim();
    if (!value) return;
    const recents = SearchService.getRecentSearches().filter(
      (entry) => entry.toLocaleLowerCase() !== value.toLocaleLowerCase()
    );
    recents.unshift(value);
    SearchService.#writeLocal("recent-searches", recents.slice(0, 10));
  }

  /** @returns {string[]} */
  static getRecentSearches() {
    const value = SearchService.#readLocal("recent-searches", []);
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string").slice(0, 10) : [];
  }

  /**
   * @param {string} needle
   * @param {string} title
   * @returns {{ rank: number, score: number }|null}
   */
  static #match(needle, title) {
    const haystack = SearchService.#normalize(title);
    if (!haystack) return null;
    if (haystack === needle) return { rank: 0, score: 0 };
    if (haystack.startsWith(needle)) return { rank: 1, score: haystack.length - needle.length };
    const partial = haystack.indexOf(needle);
    if (partial >= 0) return { rank: 2, score: partial };

    let cursor = 0;
    let gaps = 0;
    for (const character of needle) {
      const found = haystack.indexOf(character, cursor);
      if (found < 0) return null;
      gaps += found - cursor;
      cursor = found + 1;
    }
    return { rank: 3, score: gaps + haystack.length - needle.length };
  }

  /**
   * @param {SearchResult} a
   * @param {SearchResult} b
   */
  static #compare(a, b) {
    return (
      a.rank - b.rank ||
      b.recentlyOpened - a.recentlyOpened ||
      a.score - b.score ||
      a.title.localeCompare(b.title)
    );
  }

  /** @param {string} value */
  static #normalize(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
  }

  /** @returns {Record<string, number>} */
  static #readOpened() {
    const value = SearchService.#readLocal("recently-opened", {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  /** @param {string} key */
  static #recordOpened(key) {
    const opened = SearchService.#readOpened();
    opened[key] = Date.now();
    const trimmed = Object.fromEntries(
      Object.entries(opened)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
    );
    SearchService.#writeLocal("recently-opened", trimmed);
  }

  /** @param {string} key */
  static #localKey(key) {
    return `nd-companion:search:${game.world?.id ?? "world"}:${key}`;
  }

  static #readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(SearchService.#localKey(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  static #writeLocal(key, value) {
    try {
      localStorage.setItem(SearchService.#localKey(key), JSON.stringify(value));
    } catch {
      // Search history is an optional local preference.
    }
  }
}

/**
 * @typedef {object} SearchItem
 * @property {string} id
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [group]
 */

/**
 * @typedef {object} SearchProvider
 * @property {string} id
 * @property {string} label
 * @property {() => SearchItem[]} getItems
 * @property {() => SearchItem[]} [getQuickAccess]
 * @property {(id: string, context: SearchNavigationContext) => Promise<boolean>|boolean} open
 */

/**
 * @typedef {object} SearchResult
 * @property {string} key
 * @property {string} providerId
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} group
 * @property {number} rank
 * @property {number} score
 * @property {number} recentlyOpened
 */

/**
 * @typedef {object} SearchNavigationContext
 * @property {(id: string) => Promise<void>|void} openSession
 * @property {(id: string) => Promise<void>|void} openBeat
 * @property {(id: string) => Promise<void>|void} openThread
 * @property {(id: string) => Promise<void>|void} openQuestEntry
 * @property {(id: string) => Promise<void>|void} [openMemory]
 * @property {(uuid: string, kind: string) => Promise<boolean>|boolean} openEntity
 * @property {(message: string) => void} notify
 */
