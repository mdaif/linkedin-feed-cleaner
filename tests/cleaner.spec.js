const { test, expect } = require("@playwright/test");
const path = require("path");

const CONTENT_JS = path.resolve(__dirname, "..", "content.js");
const fixtureUrl = (name) =>
  "file://" + path.resolve(__dirname, "fixtures", name);

/**
 * Load a fixture, optionally strip every class/id (to simulate LinkedIn
 * rotating its class names), then inject the real content.js.
 */
async function loadFixture(page, name, { stripClasses = false } = {}) {
  await page.goto(fixtureUrl(name));
  if (stripClasses) {
    await page.evaluate(() => {
      document.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("class");
        el.removeAttribute("id");
      });
    });
  }
  await page.evaluate(() => {
    window.__lfcConfig = { feed: true, sidebar: true, news: true, debug: true };
  });
  await page.addScriptTag({ path: CONTENT_JS });
  // Let the debounced observer settle (initial pass is synchronous).
  await page.waitForTimeout(300);
}

/** For each matched element, true if it or an ancestor is display:none. */
async function hiddenFlags(page, selector) {
  return page.$$eval(selector, (els) =>
    els.map((el) => {
      let n = el;
      while (n) {
        if (getComputedStyle(n).display === "none") return true;
        n = n.parentElement;
      }
      return false;
    })
  );
}

async function expectGarbageHiddenOrganicVisible(page) {
  const garbage = await hiddenFlags(page, '[data-test="garbage"]');
  const organic = await hiddenFlags(page, '[data-test="organic"]');

  expect(garbage.length, "fixture should contain garbage units").toBeGreaterThan(0);
  expect(organic.length, "fixture should contain organic units").toBeGreaterThan(0);

  // Every garbage unit hidden; no organic unit hidden.
  expect(garbage.every(Boolean), "all garbage hidden").toBe(true);
  expect(organic.some(Boolean), "no organic hidden (no over-blocking)").toBe(false);
}

test.describe("LinkedIn Feed Cleaner — adaptive detection", () => {
  test("feed (current 2026 layout: role=list + display:contents, no urns)", async ({ page }) => {
    await loadFixture(page, "feed-current.html");
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("feed (current layout) survives class-name churn", async ({ page }) => {
    await loadFixture(page, "feed-current.html", { stripClasses: true });
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("feed (legacy urn layout): hides promoted/sponsored/suggested, keeps organic", async ({ page }) => {
    await loadFixture(page, "feed-mixed.html");
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("feed (legacy layout) survives class-name churn (urn fallback)", async ({ page }) => {
    await loadFixture(page, "feed-mixed.html", { stripClasses: true });
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("sidebar: hides 'add to your feed' / 'people you may know' / promoted cards", async ({ page }) => {
    await loadFixture(page, "sidebar-modules.html");
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("news: hides LinkedIn News / Today modules", async ({ page }) => {
    await loadFixture(page, "news-module.html");
    await expectGarbageHiddenOrganicVisible(page);
  });

  test("sidebar churn: hides modules after class names stripped", async ({ page }) => {
    await loadFixture(page, "sidebar-modules.html", { stripClasses: true });
    await expectGarbageHiddenOrganicVisible(page);
  });
});
