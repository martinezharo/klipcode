import { expect, type Locator, type Page } from "@playwright/test";

/** Shared locators/actions for the app shell, used by every e2e suite. */

export async function gotoApp(page: Page) {
  await page.goto("/app");
  // The aside header renders once the workspace has loaded client-side.
  await expect(page.getByRole("button", { name: "My Space" })).toBeVisible();
}

export function aside(page: Page): Locator {
  return page.getByRole("complementary");
}

/**
 * A folder/snippet row in the aside tree. Rows expose `treeitem` (not `button`)
 * so their expand toggle and actions menu stay reachable by assistive tech.
 */
export function asideRow(page: Page, name: string): Locator {
  return aside(page).getByRole("treeitem", { name, exact: true });
}

/**
 * Drags horizontally across an element, in `steps` moves of `dx / steps` px.
 *
 * `pauseMs` between the moves is what controls the gesture's *velocity*, which
 * the swipe recogniser weighs alongside distance: without a pause Playwright
 * replays the whole drag in a couple of milliseconds, and every swipe — however
 * short — reads as a flick.
 */
export async function dragHorizontally(
  page: Page,
  target: Locator,
  { dx, steps = 8, pauseMs = 0 }: { dx: number; steps?: number; pauseMs?: number },
) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Swipe target has no bounding box");

  const startX = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 160);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(startX + (dx * step) / steps, y);
    if (pauseMs) await page.waitForTimeout(pauseMs);
  }
  await page.mouse.up();
}
