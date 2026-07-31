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
