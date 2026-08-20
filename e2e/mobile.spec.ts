import { test, expect, type Page } from "@playwright/test";
import { dragHorizontally } from "./helpers";

/**
 * The touch layout's feed, which below `lg` replaces the aside entirely.
 *
 * Driven with the mouse rather than `page.touchscreen`: the gesture listens to
 * pointer events, which both devices raise, and Playwright's touchscreen API
 * cannot express a drag. What matters — the axis lock, the distance and
 * velocity thresholds, the suppressed click — is identical either way.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Waits for the mobile home rather than the aside `gotoApp` looks for. */
async function gotoMobileApp(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("tab", { name: "Recent" })).toBeVisible();
}

function panel(page: Page) {
  return page.getByRole("tabpanel");
}

async function expectSelected(page: Page, name: "Recent" | "My Space") {
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

test("swipes between Recent and My Space, and back", async ({ page }) => {
  await gotoMobileApp(page);
  await expectSelected(page, "Recent");

  await dragHorizontally(page, panel(page), { dx: -220 });
  await expectSelected(page, "My Space");
  // The seeded folder's row only exists in the structure tab, so the panel
  // really did change and not just the pill.
  await expect(panel(page).getByRole("button", { name: /welcome/ })).toBeVisible();

  await dragHorizontally(page, panel(page), { dx: 220 });
  await expectSelected(page, "Recent");
});

test("the switcher follows the finger before the swipe is released", async ({ page }) => {
  await gotoMobileApp(page);

  const box = await panel(page).boundingBox();
  if (!box) throw new Error("Panel has no bounding box");
  const startX = box.x + box.width / 2;
  const y = box.y + 120;

  const main = page.getByRole("main");
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 40, y);
  await page.mouse.move(startX - 120, y);

  // Mid-gesture the pill sits between the two tabs rather than waiting for the
  // release, and its settle animation is suspended so it tracks the finger.
  await expect(main).toHaveAttribute("data-swiping", "true");
  const progress = await main.evaluate((el) =>
    Number(getComputedStyle(el).getPropertyValue("--tab-progress")),
  );
  expect(progress).toBeGreaterThan(0);
  expect(progress).toBeLessThan(1);

  await page.mouse.up();
  await expect(main).not.toHaveAttribute("data-swiping", "true");
  await expectSelected(page, "My Space");
});

test("a swipe that falls short springs back", async ({ page }) => {
  await gotoMobileApp(page);

  // Under the commit distance, and slow enough not to count as a flick.
  await dragHorizontally(page, panel(page), { dx: -60, pauseMs: 40 });
  await expectSelected(page, "Recent");
});

test("a short flick still commits", async ({ page }) => {
  await gotoMobileApp(page);

  await dragHorizontally(page, panel(page), { dx: -60 });
  await expectSelected(page, "My Space");
});

test("swiping past the last tab stays there", async ({ page }) => {
  await gotoMobileApp(page);

  // Right from the first tab: there is nothing before Recent to reveal.
  await dragHorizontally(page, panel(page), { dx: 260 });
  await expectSelected(page, "Recent");
});

test("a vertical drag scrolls the feed instead of changing tab", async ({ page }) => {
  await gotoMobileApp(page);

  const box = await panel(page).boundingBox();
  if (!box) throw new Error("Panel has no bounding box");
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 120);
  await page.mouse.down();
  // Mostly vertical, with the sideways wobble a real thumb adds.
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(x + step, box.y + 120 - step * 12);
  }
  await page.mouse.up();

  await expectSelected(page, "Recent");
});

test("swiping off a snippet card does not open the snippet", async ({ page }) => {
  await gotoMobileApp(page);

  const card = page.getByRole("button", { name: "klipcode.md", exact: true }).first();
  await expect(card).toBeVisible();

  await dragHorizontally(page, card, { dx: -220 });

  await expectSelected(page, "My Space");
  await expect(page).toHaveURL(/\/app$/);
});

test("the tab buttons still switch on their own", async ({ page }) => {
  await gotoMobileApp(page);

  await page.getByRole("tab", { name: "My Space" }).click();
  await expectSelected(page, "My Space");

  await page.getByRole("tab", { name: "Recent" }).click();
  await expectSelected(page, "Recent");
});
