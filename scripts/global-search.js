import { SearchService } from "./search-service.js";

/**
 * One visible global search component shared by mouse and Ctrl/Cmd+K.
 */
export class GlobalSearch {
  /** @type {WeakMap<HTMLElement, AbortController>} */
  static #listeners = new WeakMap();

  /** @type {AbortController|null} */
  static #activeController = null;

  /**
   * @param {HTMLElement} root
   * @param {import("./search-service.js").SearchNavigationContext} context
   */
  static attach(root, context) {
    if (!(root instanceof HTMLElement)) return;
    const search = root.querySelector("[data-global-search]");
    const input = root.querySelector("[data-global-search-input]");
    const results = root.querySelector("[data-global-search-results]");
    if (
      !(search instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(results instanceof HTMLElement)
    ) return;

    GlobalSearch.#activeController?.abort();
    GlobalSearch.#listeners.get(search)?.abort();
    const controller = new AbortController();
    GlobalSearch.#activeController = controller;
    GlobalSearch.#listeners.set(search, controller);
    let activeIndex = 0;

    const interactive = () =>
      [...results.querySelectorAll("[data-search-result-key], [data-search-recent]")].filter(
        (element) => element instanceof HTMLButtonElement
      );

    const paintActive = () => {
      const options = interactive();
      if (options.length === 0) return;
      activeIndex = Math.min(Math.max(activeIndex, 0), options.length - 1);
      options.forEach((option, index) => {
        option.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      });
      options[activeIndex]?.scrollIntoView({ block: "nearest" });
    };

    const render = () => {
      activeIndex = 0;
      GlobalSearch.#render(results, input.value);
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      paintActive();
    };

    const close = () => {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
    };

    const select = async (button) => {
      const recent = button.getAttribute("data-search-recent");
      if (recent !== null) {
        input.value = recent;
        render();
        input.focus();
        return;
      }
      const key = button.getAttribute("data-search-result-key");
      if (!key) return;
      SearchService.recordSearch(input.value);
      close();
      input.value = "";
      await SearchService.open(key, context);
    };

    input.addEventListener("focus", render, { signal: controller.signal });
    input.addEventListener("input", render, { signal: controller.signal });
    input.addEventListener(
      "keydown",
      (event) => {
        const options = interactive();
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (results.hidden || options.length === 0) return;
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          activeIndex = (activeIndex + delta + options.length) % options.length;
          paintActive();
          return;
        }
        if (event.key === "Enter" && !results.hidden && options[activeIndex]) {
          event.preventDefault();
          void select(options[activeIndex]);
        }
      },
      { signal: controller.signal }
    );

    results.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("[data-search-result-key], [data-search-recent]");
        if (!(button instanceof HTMLButtonElement)) return;
        event.preventDefault();
        void select(button);
      },
      { signal: controller.signal }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k") {
          return;
        }
        event.preventDefault();
        input.focus();
        input.select();
        render();
      },
      { signal: controller.signal }
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (target instanceof Node && !search.contains(target)) close();
      },
      { signal: controller.signal }
    );
  }

  /**
   * @param {HTMLElement} container
   * @param {string} query
   */
  static #render(container, query) {
    container.replaceChildren();
    const value = query.trim();

    if (!value) {
      GlobalSearch.#appendHeading(container, "Recent Searches");
      const recent = SearchService.getRecentSearches();
      if (recent.length === 0) {
        GlobalSearch.#appendEmpty(container, "No recent searches.");
      } else {
        for (const term of recent) {
          const button = GlobalSearch.#button(term, "Search again");
          button.dataset.searchRecent = term;
          container.append(button);
        }
      }

      GlobalSearch.#appendHeading(container, "Quick Access");
      const quick = SearchService.quickAccess();
      if (quick.length === 0) {
        GlobalSearch.#appendEmpty(container, "No quick access items.");
      } else {
        for (const result of quick) container.append(GlobalSearch.#resultButton(result));
      }
      return;
    }

    const groups = SearchService.search(value);
    if (groups.length === 0) {
      GlobalSearch.#appendEmpty(container, "No campaign results.");
      return;
    }

    for (const group of groups) {
      GlobalSearch.#appendHeading(container, group.label);
      for (const result of group.results) {
        container.append(GlobalSearch.#resultButton(result));
      }
    }
  }

  /**
   * @param {import("./search-service.js").SearchResult} result
   */
  static #resultButton(result) {
    const kind = GlobalSearch.#entityKindForResult(result);
    const button = GlobalSearch.#button(result.title, result.subtitle, kind);
    button.dataset.searchResultKey = result.key;
    return button;
  }

  /**
   * @param {import("./search-service.js").SearchResult} result
   */
  static #entityKindForResult(result) {
    switch (result.providerId) {
      case "story-threads":
        return "storyThread";
      case "quests":
        return "quest";
      case "factions":
        return "faction";
      case "sessions":
      case "beats":
        return "chronicle";
      case "campaign-activity": {
        const parts = String(result.key).split(":");
        return parts[1] || "activity";
      }
      case "entities": {
        const group = String(result.group || "").toUpperCase();
        if (group.includes("ACTOR")) return "actor";
        if (group.includes("LOCATION") || group.includes("SCENE")) return "location";
        if (group.includes("ITEM")) return "item";
        if (group.includes("JOURNAL")) return "journal";
        if (group.includes("ROLL")) return "rollTable";
        return "item";
      }
      default:
        return "";
    }
  }

  static #button(title, subtitle, entityKind = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nd-global-search__result";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");

    if (entityKind) {
      const badge = document.createElement("span");
      badge.className = "nd-entity-badge";
      badge.dataset.entityKind = entityKind;
      badge.textContent = GlobalSearch.#kindLabel(entityKind);
      button.append(badge);
    }

    const text = document.createElement("span");
    text.className = "nd-global-search__result-text";
    const titleElement = document.createElement("span");
    titleElement.className = "nd-global-search__result-title";
    titleElement.textContent = title;
    const subtitleElement = document.createElement("span");
    subtitleElement.className = "nd-global-search__result-subtitle";
    subtitleElement.textContent = subtitle;
    text.append(titleElement, subtitleElement);
    button.append(text);
    return button;
  }

  static #kindLabel(kind) {
    switch (kind) {
      case "storyThread":
        return "Thread";
      case "quest":
      case "questEntry":
        return "Quest";
      case "actor":
        return "Actor";
      case "faction":
        return "Faction";
      case "location":
      case "scene":
        return "Location";
      case "item":
        return "Item";
      case "chronicle":
      case "memory":
        return "Chronicle";
      case "journal":
        return "Journal";
      case "rollTable":
        return "Table";
      case "activity":
        return "Activity";
      default:
        return kind || "Item";
    }
  }

  static #appendHeading(container, label) {
    const heading = document.createElement("div");
    heading.className = "nd-global-search__group";
    heading.textContent = label;
    container.append(heading);
  }

  static #appendEmpty(container, text) {
    const empty = document.createElement("div");
    empty.className = "nd-global-search__empty";
    empty.textContent = text;
    container.append(empty);
  }
}
