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
    -   Other engagement-bait blocks
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

## How It Works

LinkedIn injects feed units labeled *Suggested*, *Sponsored*, and
similar.
These items are wrapped in unstable, deeply nested DOM structures with
frequently changing class names.

This extension uses a `MutationObserver` and removes any feed block
containing:

-   The "Suggested" label.
-   The "Sponsored" glyph or text.
-   "Promoted" and similar marketing indicators.
-   Known DOM patterns around LinkedIn's promoted feed modules.

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
    └── README.md

## Privacy

This extension:

-   Collects **no data**
-   Sends **no data** anywhere
-   Stores **no information**
-   Has **no analytics**
-   Performs **zero network requests**

## Roadmap

-   Optional UI toggle
-   Configurable filter rules
-   Firefox version
-   Even stronger heuristics for new LinkedIn layouts
-   Toggle to collapse instead of remove

## Contributing

Issues and PRs are welcome.
Feel free to contribute improvements or new filtering rules.

## License

MIT License --- see `LICENSE`.

## If you find this useful...

A star on GitHub helps other people discover it.

