import { test, expect, type Locator, type Page } from "@playwright/test";
import { aside, asideRow, gotoApp } from "./helpers";

/**
 * Smoke tests for the core product flows (AGENTS.md priorities: create and
 * copy snippets with no friction, move through the app quickly). They run
 * against a clean browser profile, so every test starts from the first-visit
 * seed: a "welcome" folder containing a "klipcode" snippet pinned to Home.
 * No backend is needed — the whole workspace lives in IndexedDB.
 */

async function selectInputTextWithMouse(page: Page, input: Locator) {
  const box = await input.boundingBox();
  if (!box) throw new Error("Rename input has no bounding box");

  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 6, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 6, y, { steps: 8 });
  await page.mouse.up();

  return input.evaluate((element: HTMLInputElement) =>
    element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0),
  );
}

test("first visit seeds the welcome workspace on Home", async ({ page }) => {
  await gotoApp(page);

  await expect(asideRow(page, "welcome")).toBeVisible();

  // The seeded snippet is pinned to Home, so its card shows up there. Cards
  // are named by display name: the title plus the language extension.
  await expect(page.getByRole("button", { name: "klipcode.md", exact: true }).first()).toBeVisible();
});

test("creates a snippet and copies its content", async ({ page }) => {
  await gotoApp(page);

  await aside(page).getByRole("button", { name: "New snippet" }).click();

  const dialog = page.getByRole("dialog");
  // A ".js" title pins the language, so the display name stays "greeting.js".
  await dialog.getByRole("textbox", { name: "Snippet title" }).fill("greeting.js");
  // The code field is a CodeMirror editor, not a native textarea, so it is
  // only reachable by role + accessible name.
  await dialog
    .getByRole("textbox", { name: "Write or paste your code here..." })
    .fill("console.log('hello from e2e');");
  await dialog.getByRole("button", { name: "Create snippet" }).click();
  await expect(dialog).toBeHidden();

  // Open it from the aside tree and copy its content from the editor.
  await asideRow(page, "greeting.js").click();
  await expect(page).toHaveURL(/\/app\?snippet=/);
  await page.getByRole("button", { name: "Copy code" }).first().click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe("console.log('hello from e2e');");
});

test("creates folders from a path typed in the snippet title", async ({ page }) => {
  await gotoApp(page);

  await aside(page).getByRole("button", { name: "New snippet" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Snippet title" }).fill("recipes/utils/greeting.js");
  await dialog
    .getByRole("textbox", { name: "Write or paste your code here..." })
    .fill("export const greeting = 'hello';");
  await dialog.getByRole("button", { name: "Create snippet" }).click();
  await expect(dialog).toBeHidden();

  await expect(asideRow(page, "recipes")).toBeVisible();
  await asideRow(page, "recipes").click();
  await expect(page.getByRole("main").getByText("utils", { exact: true }).first()).toBeVisible();
  await page.getByRole("main").getByText("utils", { exact: true }).first().click();
  await expect(page.getByRole("main").getByRole("button", { name: "greeting.js" })).toBeVisible();
});

test("rename inputs allow mouse text selection without dragging cards", async ({ page }) => {
  await gotoApp(page);
  await page.getByRole("button", { name: "My Space" }).click();

  const folderCard = page
    .getByRole("main")
    .locator('[data-selectable-type="folder"]')
    .first();
  await folderCard.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const folderInput = folderCard.locator("input");
  await expect(folderCard).toHaveAttribute("draggable", "false");
  expect(await selectInputTextWithMouse(page, folderInput)).not.toBe("");
  await folderInput.press("Escape");
  await expect(folderCard).toHaveAttribute("draggable", "true");

  await folderCard.click();
  const snippetCard = page
    .getByRole("main")
    .locator("[data-snippet-card]")
    .first();
  await snippetCard.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const snippetInput = snippetCard.locator("input");
  await expect(snippetCard).toHaveAttribute("draggable", "false");
  expect(await selectInputTextWithMouse(page, snippetInput)).not.toBe("");
  await snippetInput.press("Escape");
  await expect(snippetCard).toHaveAttribute("draggable", "true");
});

test("navigates into a folder and back to Home", async ({ page }) => {
  await gotoApp(page);

  await asideRow(page, "welcome").click();
  await expect(page).toHaveURL(/\/app\?folder=/);

  // The folder view lists the seeded snippet.
  await expect(page.getByRole("button", { name: "klipcode.md", exact: true }).first()).toBeVisible();

  // The breadcrumb root goes up to the space root view, which lists the folder.
  await page.getByRole("main").getByRole("button", { name: "My Space" }).first().click();
  await expect(page).toHaveURL(/\/app\?folder=__space_root__/);
  await expect(page.getByRole("main").getByText("welcome", { exact: true }).first()).toBeVisible();
});

test("open in new tab lands on the snippet view, not the landing page", async ({
  page,
  context,
}) => {
  await gotoApp(page);

  const card = page.locator("[data-snippet-card]", { hasText: "klipcode" }).first();
  await card.click({ button: "right" });

  const newPagePromise = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Open in new tab" }).click();
  const newPage = await newPagePromise;

  // The regression this guards: these links once pointed at "/?snippet=",
  // which is the marketing landing page, instead of the app at /app.
  await newPage.waitForURL(/\/app\?snippet=/);
  await expect(newPage.getByRole("button", { name: "Copy code" }).first()).toBeVisible();
});

test("resizes the aside and remembers the width", async ({ page }) => {
  await gotoApp(page);

  const handle = page.getByRole("separator", { name: "Resize panel" });
  const asideWidth = async () => {
    const box = await aside(page).boundingBox();
    if (!box) throw new Error("Aside has no bounding box");
    return box.width;
  };
  const grabHandle = async () => {
    const box = await handle.boundingBox();
    if (!box) throw new Error("Resize handle has no bounding box");
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + 200);
    await page.mouse.down();
    return x;
  };

  expect(await asideWidth()).toBe(240);

  const from = await grabHandle();
  await page.mouse.move(from + 100, 200, { steps: 8 });
  await page.mouse.up();
  expect(await asideWidth()).toBe(340);

  // Arrow keys resize too: a drag-only affordance puts the width out of reach
  // for anyone not using a mouse.
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await asideWidth()).toBe(324);

  // A fresh visit applies the stored width — before first paint, so the panel
  // never animates out from the default (see lib/asideWidth.ts).
  await gotoApp(page);
  expect(await asideWidth()).toBe(324);

  // Crossing the snap threshold previews the collapsed state immediately. The
  // pointer is still captured by the handle, so reversing the same drag opens
  // the panel again without requiring a second gesture.
  const reversibleFrom = await grabHandle();
  await page.mouse.move(20, 200, { steps: 10 });
  const shell = page.locator(".klipcode-aside-shell");
  const recoveryCue = page.locator("[data-aside-recovery]");
  await expect(shell).toHaveCSS("transition-duration", "0.18s");
  await expect(shell).toHaveCSS("width", "0px");
  await expect(recoveryCue).toBeVisible();
  await expect(recoveryCue).toHaveCSS("opacity", "1");
  expect((await recoveryCue.boundingBox())?.x).toBe(0);
  await page.mouse.move(reversibleFrom, 200, { steps: 10 });
  await expect(shell).toHaveCSS("width", "324px");
  await expect(recoveryCue).toBeHidden();
  await page.mouse.up();
  expect(await asideWidth()).toBe(324);

  // Dragging shut collapses the panel, and re-opening restores the width the
  // user chose rather than the default.
  await grabHandle();
  await page.mouse.move(20, 200, { steps: 10 });
  await page.mouse.up();

  const reopen = page.getByRole("button", { name: "Open panel" });
  await expect(reopen).toBeVisible();
  await expect(reopen).toHaveCSS("opacity", "1");
  const reopenBox = await reopen.boundingBox();
  expect(Math.round(reopenBox?.x ?? -1)).toBe(0);
  expect(reopenBox?.width).toBeGreaterThanOrEqual(24);
  expect(reopenBox?.height).toBeGreaterThanOrEqual(24);
  await reopen.click();
  await expect(handle).toBeVisible();
  expect(await asideWidth()).toBe(324);
});

test("collapsing the aside takes it out of the tab order", async ({ page }) => {
  await gotoApp(page);

  // Straight off a fresh load, with focus still on <body>: the keyboard toggle
  // must land somewhere usable rather than leaving the user nowhere.
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("button", { name: "Open panel" })).toBeFocused({ timeout: 1000 });
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("button", { name: "Collapse panel" })).toBeFocused({ timeout: 1000 });

  await page.getByRole("button", { name: "Collapse panel" }).click();

  // The pressed control is now inert, so focus has to move to the toggle that
  // replaced it — otherwise the keyboard user is dropped back on <body>.
  const openPanel = page.getByRole("button", { name: "Open panel" });
  await expect(openPanel).toBeFocused();

  // Tabbing on never walks into the hidden panel, which is still in the DOM
  // (clipped to zero width) but inert.
  const insideAside = () =>
    page.evaluate(() => !!document.activeElement?.closest("#klipcode-aside"));
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await insideAside()).toBe(false);
  }

  await openPanel.click();
  await expect(page.getByRole("button", { name: "Collapse panel" })).toBeFocused();

  // Same hand-off for the keyboard toggle, which is where being stranded on
  // <body> would hurt most.
  await page.keyboard.press("ControlOrMeta+b");
  await expect(openPanel).toBeFocused();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("button", { name: "Collapse panel" })).toBeFocused();
});

test("/es/app renders the app in Spanish", async ({ page }) => {
  await page.goto("/es/app");

  await expect(page.getByRole("button", { name: "Mi Espacio" })).toBeVisible();
  await expect(
    aside(page).getByRole("button", { name: "Nuevo snippet" }),
  ).toBeVisible();
});
