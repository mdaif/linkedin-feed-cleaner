const BAD_LABELS = [
  "suggested",
  "promoted",
  "sponsored",
  "ad",
  "ads",
  "advertisement"
];

const BAD_PHRASES = [
  "suggested for you",
  "because you viewed",
  "because you follow",
  "recommended for you",
  "you might be interested",
  "try premium for free",
  "promoted",
  "sponsored",
  "ad ·",
  "ads ·",
  "advertisement"
];

function hideElement(el) {
  if (!el) return;
  if (el.dataset.gptHidden === "1") return;
  el.style.display = "none";
  el.dataset.gptHidden = "1";
}

// -------------------------------------------------------------
// Find the nearest *real* post container, even with weird wrappers
// -------------------------------------------------------------
function findPostContainerFrom(node) {
  let current = node;
  let lastGood = null;

  for (let i = 0; i < 25 && current && current !== document.body; i++) {
    if (
      current.classList?.contains("feed-shared-update-v2") ||
      current.classList?.contains("feed-shared-update-v3")
    ) {
      lastGood = current;
    }

    const dataId = current.getAttribute?.("data-id") || "";
    if (dataId.startsWith("urn:li:activity:")) {
      lastGood = current;
    }

    // NEW LOGIC:
    // If this wrapper contains a post inside it, treat it as a post root
    if (!lastGood) {
      if (
        current.querySelector?.(".feed-shared-update-v2, .feed-shared-update-v3")
      ) {
        lastGood = current;
      }
    }

    current = current.parentElement;
  }

  return lastGood;
}

// -------------------------------------------------------------
// Explicit "Suggested" remover
// -------------------------------------------------------------
function hideSuggestedHeaders() {
  const headers = document.querySelectorAll(
    "span.update-components-header__text-view"
  );

  headers.forEach(span => {
    const text = (span.innerText || "").trim().toLowerCase();
    if (text !== "suggested") return;

    const post = findPostContainerFrom(span);
    if (post) hideElement(post);
  });
}

// -------------------------------------------------------------
// Evaluate a full post container
// -------------------------------------------------------------
function evaluatePost(post) {
  if (!post) return;
  if (post.dataset.gptChecked === "1") return;
  post.dataset.gptChecked = "1";

  // Direct labels
  const labels = post.querySelectorAll(
    ".update-components-header__text-view, .update-components-actor__sub-description"
  );

  for (const l of labels) {
    const text = (l.innerText || "").trim().toLowerCase();
    if (BAD_LABELS.includes(text)) {
      hideElement(post);
      return;
    }
  }

  // Fallback
  const text = (post.innerText || "").toLowerCase();
  if (BAD_PHRASES.some(p => text.includes(p))) hideElement(post);
}

// -------------------------------------------------------------
// Feed scanning
// -------------------------------------------------------------
function cleanFeed() {
  // This catches most posts
  const posts = document.querySelectorAll(
    "div[data-id^='urn:li:activity:'], .feed-shared-update-v2, .feed-shared-update-v3"
  );

  posts.forEach(p => evaluatePost(p));

  // Additional catch: suggested headers that sit in a weird wrapper
  hideSuggestedHeaders();
}

// -------------------------------------------------------------
// Sidebar cleanup
// -------------------------------------------------------------
function cleanSidebar() {
  const cards = document.querySelectorAll("aside .artdeco-card");

  cards.forEach(card => {
    if (card.dataset.gptChecked === "1") return;
    card.dataset.gptChecked = "1";

    const text = (card.innerText || "").toLowerCase();
    if (
      text.includes("add to your feed") ||
      text.includes("people you may know") ||
      text.includes("promoted") ||
      text.includes("sponsored") ||
      text.includes("suggested")
    ) {
      hideElement(card);
    }
  });
}

function cleanAll() {
  cleanFeed();
  cleanSidebar();
}

cleanAll();
document.addEventListener("DOMContentLoaded", cleanAll);

new MutationObserver(() => cleanAll()).observe(document.body, {
  childList: true,
  subtree: true
});
