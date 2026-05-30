# LinkedIn Feed Cleaner

A lightweight Chrome extension that automatically hides **Suggested**,
**Sponsored**, **Promoted**, and other low-value content from your
LinkedIn feed.

No tracking. No scraping. No API usage.
Just simple client-side DOM filtering for a cleaner, quieter feed.

# Discalimer
This project is entirely generated through the help of chatGpt, and
I've created it for my personal use. I thought I couldn't be the
only one tired of the Linkedin AI doomers feed, and I wanted to
share the love :-)

## Features

-   Removes posts marked as:
    -   **Suggested**
    -   **Sponsored**
    -   **Promoted**
    -   "Because you follow..."
    -   "Because you watched..."
    -   **Popular course on LinkedIn Learning** (and similar course promos)
    -   Other engagement-bait blocks
-   Removes sidebar modules ("Add to your feed", "People you may know")
    and the News / "Today" / puzzles rail
-   Works dynamically with infinite scroll
-   Zero performance overhead
-   No external dependencies
-   Fully local --- nothing leaves your browser

## Installation (Developer Mode)

1.  Clone this repository:

    ``` bash
    git clone https://github.com/<your-username>/linkedin-feed-cleaner.git
    ```

2.  Open Chrome → `chrome://extensions/`

3.  Enable **Developer mode** (top-right corner)

4.  Click **Load unpacked**

5.  Select the project folder

## How It Works (and how it adapts)

LinkedIn injects feed units labeled *Suggested*, *Sponsored*, and
similar, wrapped in deeply nested DOM with **frequently changing class
names** — class names are rotated specifically to break extensions.

So this extension deliberately **does not depend on class names** (on
today's LinkedIn the classes are hashed gibberish like `_2f9e3fe1` and
there are no `urn:li:*` attributes left in the feed at all). Instead it
keys off signals LinkedIn has to keep stable:

-   **Structure** — the feed is a `[role="list"]` (required for
    accessibility) and each post is one of its direct children. That
    role + child relationship is the primary anchor and survives class
    churn. For older layouts there's a fallback that anchors on
    `data-id="urn:li:activity:…"` and climbs to the single-post wrapper.
-   **Text & accessibility labels** — "Promoted", "Sponsored",
    "Suggested", "because you follow…" must stay human-readable (and
    appear in screen-reader-only spans), so we match on an element's own
    short label text and on `aria-label` / `alt` / `title`. Strict
    label matching avoids hiding organic posts that merely mention these
    words in their body (e.g. "I just got promoted") — a post that's
    surfaced because a connection "likes this" or "finds this
    insightful" is kept; only actual Promoted/Suggested units are hidden.

A debounced `MutationObserver` re-scans as new content streams in.
Enable `window.__lfcConfig = { debug: true }` in the console to log each
hidden unit and the signal that matched it — this is how to re-learn
signals if LinkedIn changes again.

It does **not**:

-   Scrape or interact with LinkedIn APIs.
-   Automate liking/commenting/sharing.
-   Send or store data.
-   Modify LinkedIn traffic.

Everything happens locally inside the browser.

## File Structure

    linkedin-feed-cleaner/
    ├── manifest.json
    ├── content.js
    ├── package.json
    ├── playwright.config.js
    ├── tests/
    │   ├── cleaner.spec.js      # asserts garbage hidden, organic kept
    │   └── fixtures/*.html      # captured/synthetic feed snapshots
    └── README.md

## Testing

Automated, offline regression tests (no LinkedIn login needed) run the
real `content.js` against saved HTML fixtures in a headless browser:

``` bash
npm install
npx playwright install chromium
npm test
```

The suite checks both directions — every "garbage" unit gets hidden and
no "organic" unit does — and includes **layout-churn tests** that strip
all class names from a fixture and assert the cleaner still works,
proving it doesn't rely on LinkedIn's class names.

## Privacy

This extension:

-   Collects **no data**
-   Sends **no data** anywhere
-   Stores **no information**
-   Has **no analytics**
-   Performs **zero network requests**

## Roadmap

-   Optional UI toggle
-   Configurable filter rules (lists are already centralized in `content.js`)
-   Firefox version
-   Toggle to collapse instead of remove

## Contributing

Issues and PRs are welcome.
Feel free to contribute improvements or new filtering rules.

## License

MIT License --- see `LICENSE`.

## If you find this useful...

A star on GitHub helps other people discover it.

