/* =====================================================================
 * LinkedIn Feed Cleaner — layout-adaptive content script
 *
 * Design goal: survive LinkedIn's frequent class-name churn. We do NOT
 * rely on volatile class names (e.g. feed-shared-update-v2). Instead we
 * locate units using STABLE signals:
 *   - functional attributes LinkedIn keeps for its own JS/data
 *     (data-id / data-urn carrying "urn:li:activity:" etc.)
 *   - structural position (a post is the wrapper that bounds exactly one
 *     feed item inside the scrolling feed list)
 *   - text/accessibility labels ("Promoted", "Sponsored", "Suggested",
 *     "because you follow…") which LinkedIn must keep human-readable.
 * ===================================================================== */
(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Config (overridable from tests/console via window.__lfcConfig)
  // ------------------------------------------------------------------
  const CONFIG = Object.assign(
    { feed: true, sidebar: true, news: true, debug: false },
    (typeof window !== "undefined" && window.__lfcConfig) || {}
  );

  // Short standalone labels — matched as an element's OWN text (exact or
  // label+separator). Kept strict to avoid hiding organic posts that merely
  // mention these words in their body.
  const BAD_LABELS = [
    "promoted",
    "sponsored",
    "suggested",
    "ad",
    "ads",
    "advertisement",
  ];

  // Multi-word phrases — safe to match as a substring of a short header label.
  // (Single ambiguous words like "promoted" are intentionally NOT here; they
  // are handled by the strict label matcher above.)
  const BAD_PHRASES = [
    "suggested for you",
    "because you viewed",
    "because you follow",
    "because you reacted",
    "because you searched",
    "recommended for you",
    "you might be interested",
    "you might like",
    "try premium for free",
    "promoted by",
    // LinkedIn Learning course promos surfaced in the feed.
    "popular course",
    "recommended course",
    "course on linkedin learning",
    "courses for you",
  ];

  // Distinctive multi-word phrases used to spot sidebar / news modules.
  const SIDEBAR_PHRASES = [
    "add to your feed",
    "people you may know",
    "people also viewed",
    "promoted",
    "sponsored",
  ];
  const NEWS_PHRASES = [
    "linkedin news",
    "today's news",
    "todays news",
    "top stories",
    "trending now",
    "the buzz",
    "games", // "Today's puzzle games" rail
  ];

  // data-id / data-urn values that mark a top-level feed unit.
  const FEED_URN_RE = /urn:li:(activity|share|ugcPost|aggregate):/i;
  const ANCHOR_SELECTOR =
    '[data-id*="urn:li:activity:"],[data-urn*="urn:li:activity:"],' +
    '[data-id*="urn:li:share:"],[data-urn*="urn:li:share:"],' +
    '[data-id*="urn:li:ugcPost:"],[data-urn*="urn:li:ugcPost:"]';

  const HIDDEN_FLAG = "lfcHidden";
  const CHECKED_FLAG = "lfcChecked";
  const MAX_CLIMB = 18;
  const MAX_LABEL_LEN = 60; // labels are short; longer text is body content

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function hideElement(el, reason) {
    if (!el || el.dataset[HIDDEN_FLAG] === "1") return;
    el.style.setProperty("display", "none", "important");
    el.dataset[HIDDEN_FLAG] = "1";
    if (CONFIG.debug) {
      // This log is how we re-learn signals when LinkedIn changes layout.
      console.debug("[LFC] hidden (" + reason + ")", el);
    }
  }

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // An element's OWN immediate text (text nodes that are direct children),
  // not the aggregated subtree — so "Promoted" in its own span is caught but
  // a long post body is not collapsed into a label.
  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3 /* TEXT_NODE */) t += n.nodeValue;
    }
    return norm(t);
  }

  function matchesBadLabel(text) {
    if (!text || text.length > MAX_LABEL_LEN) return null;
    for (const lbl of BAD_LABELS) {
      if (
        text === lbl ||
        text.startsWith(lbl + " ") ||
        text.startsWith(lbl + "·") ||
        text.startsWith(lbl + "•") ||
        text.startsWith(lbl + " ·") ||
        text.startsWith(lbl + " •")
      ) {
        return lbl;
      }
    }
    for (const p of BAD_PHRASES) {
      if (text.includes(p)) return p;
    }
    return null;
  }

  // Scan a unit for a bad signal in any element's own text, aria-label,
  // alt, or title attribute. Returns the matched string or null.
  function findBadSignal(root) {
    const all = root.querySelectorAll("*");
    for (const el of all) {
      const hit = matchesBadLabel(ownText(el));
      if (hit) return hit;
      for (const attr of ["aria-label", "alt", "title"]) {
        const v = el.getAttribute && el.getAttribute(attr);
        if (v) {
          const h = matchesBadLabel(norm(v));
          if (h) return h;
        }
      }
    }
    // Also check the root's own attributes.
    for (const attr of ["aria-label", "title"]) {
      const v = root.getAttribute && root.getAttribute(attr);
      if (v) {
        const h = matchesBadLabel(norm(v));
        if (h) return h;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Find top-level feed-unit roots WITHOUT relying on class names.
  //
  // PRIMARY (current LinkedIn, 2026): the feed is a `[role="list"]` whose
  // direct children are the feed units (one post each, often wrapped in a
  // `display:contents` element with hashed class names — no urns, no
  // `role="article"`). The list role + child structure is stable because
  // it is required for accessibility, so we anchor on it.
  //
  // FALLBACK (older layouts): anchor on stable urn-bearing nodes
  // (`urn:li:activity:` …) and climb to the wrapper that bounds a single
  // feed item — stop climbing once the parent would contain more than one
  // anchor (that parent is the feed list, not the post).
  //
  // Finally drop candidates nested inside other candidates (reshares).
  // ------------------------------------------------------------------
  function pickFeedList() {
    const lists = Array.from(
      document.querySelectorAll(
        'main [role="list"], [role="main"] [role="list"], .scaffold-finite-scroll__content'
      )
    );
    if (!lists.length) return null;
    // The feed list is the one holding the most direct children.
    lists.sort((a, b) => b.childElementCount - a.childElementCount);
    return lists[0];
  }

  function anchorCount(el) {
    let n = 0;
    if (el.matches && el.matches(ANCHOR_SELECTOR)) n++;
    n += el.querySelectorAll(ANCHOR_SELECTOR).length;
    return n;
  }

  function postRootFor(anchor) {
    let el = anchor;
    for (let i = 0; i < MAX_CLIMB; i++) {
      const parent = el.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) {
        break;
      }
      // If the parent holds more than one feed anchor, it's the list/container
      // and `el` is the single-post boundary.
      if (anchorCount(parent) > 1) break;
      // Structural stop: parent is an obvious feed list / main region.
      if (
        parent.matches &&
        parent.matches('[role="list"], main, [role="main"], .scaffold-finite-scroll__content')
      ) {
        break;
      }
      el = parent;
    }
    return el;
  }

  function collectFeedRoots() {
    const roots = new Set();

    // PRIMARY: direct children of the feed list.
    const feed = pickFeedList();
    if (feed) {
      for (const child of feed.children) {
        if (child.nodeType === 1) roots.add(child);
      }
    }

    // FALLBACK: legacy urn-anchored layouts.
    const anchors = Array.from(document.querySelectorAll(ANCHOR_SELECTOR)).filter(
      (a) => {
        const id = a.getAttribute("data-id") || a.getAttribute("data-urn") || "";
        return FEED_URN_RE.test(id);
      }
    );
    for (const a of anchors) roots.add(postRootFor(a));

    // Drop nested candidates (e.g. an embedded reshare inside an outer post):
    // keep only the outermost.
    const list = Array.from(roots);
    return list.filter(
      (c) => !list.some((o) => o !== c && o.contains(c))
    );
  }

  function cleanFeed() {
    if (!CONFIG.feed) return;
    const roots = collectFeedRoots();
    for (const post of roots) {
      if (!post || post.dataset[CHECKED_FLAG] === "1") continue;
      post.dataset[CHECKED_FLAG] = "1";
      const signal = findBadSignal(post);
      if (signal) hideElement(post, "feed:" + signal);
    }
  }

  // ------------------------------------------------------------------
  // Sidebar / News modules (right & left rails) — class-name-free.
  // We look at aside-scoped "card-like" blocks and match distinctive
  // module phrases against their heading/visible text.
  // ------------------------------------------------------------------
  function collectAsideCards() {
    const cards = new Set();
    const asides = document.querySelectorAll('aside, [role="complementary"]');
    for (const aside of asides) {
      aside
        .querySelectorAll('section, [role="region"], .artdeco-card, [class*="card"]')
        .forEach((c) => cards.add(c));
      // Structural fallback when classes/sections are gone: direct child blocks.
      Array.from(aside.children).forEach((c) => {
        if (c.nodeType === 1 && norm(c.innerText).length > 0) cards.add(c);
      });
    }
    // Keep outermost cards only.
    const list = Array.from(cards);
    return list.filter((c) => !list.some((o) => o !== c && o.contains(c)));
  }

  function headingText(card) {
    const h = card.querySelector("h1,h2,h3,h4,[role='heading']");
    return norm(h ? h.innerText : "");
  }

  function cleanAside() {
    if (!CONFIG.sidebar && !CONFIG.news) return;
    const cards = collectAsideCards();
    for (const card of cards) {
      if (card.dataset[CHECKED_FLAG] === "1") continue;
      card.dataset[CHECKED_FLAG] = "1";

      const heading = headingText(card);
      const text = norm(card.innerText);
      let reason = null;

      if (CONFIG.sidebar && SIDEBAR_PHRASES.some((p) => text.includes(p) || heading.includes(p))) {
        reason = "sidebar";
      }
      if (!reason && CONFIG.news && NEWS_PHRASES.some((p) => heading.includes(p) || text.includes(p))) {
        reason = "news";
      }
      if (reason) hideElement(card, reason);
    }
  }

  // ------------------------------------------------------------------
  // Orchestration + adaptive (debounced) observer
  // ------------------------------------------------------------------
  function cleanAll() {
    try {
      cleanFeed();
      cleanAside();
    } catch (e) {
      if (CONFIG.debug) console.debug("[LFC] scan error", e);
    }
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      cleanAll();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 200);
    }
  }

  // Initial passes.
  cleanAll();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanAll);
  }

  // React to infinite scroll / lazy loads without re-scanning on every
  // single mutation (the old version did, which was costly).
  const target = document.body || document.documentElement;
  if (target) {
    new MutationObserver(scheduleScan).observe(target, {
      childList: true,
      subtree: true,
    });
  }

  // Expose for manual debugging: window.__lfc.clean()
  if (typeof window !== "undefined") {
    window.__lfc = { clean: cleanAll, config: CONFIG };
  }
})();
