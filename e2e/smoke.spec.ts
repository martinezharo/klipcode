import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Smoke tests for the core product flows (AGENTS.md priorities: create and
 * copy snippets with no friction, move through the app quickly). They run
 * against a clean browser profile, so every test starts from the first-visit
 * seed: a "welcome" folder containing a "klipcode" snippet pinned to Home.
 * No backend is needed — the whole workspace lives in IndexedDB.
 */

async function gotoApp(page: Page) {
  await page.goto("/app");
  // The aside header renders once the workspace has loaded client-side.
  await expect(page.getByRole("button", { name: "My Space" })).toBeVisible();
}

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

  const aside = page.getByRole("complementary");
  await expect(aside.getByRole("button", { name: "welcome", exact: true })).toBeVisible();

  // The seeded snippet is pinned to Home, so its card shows up there. Cards
  // are named by display name: the title plus the language extension.
  await expect(page.getByRole("button", { name: "klipcode.md", exact: true }).first()).toBeVisible();
});

test("creates a snippet and copies its content", async ({ page }) => {
  await gotoApp(page);

  await page.getByRole("complementary").getByRole("button", { name: "New snippet" }).click();

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
  await page.getByRole("complementary").getByRole("button", { name: "greeting.js" }).click();
  await expect(page).toHaveURL(/\/app\?snippet=/);
  await page.getByRole("button", { name: "Copy code" }).first().click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe("console.log('hello from e2e');");
});

test("creates folders from a path typed in the snippet title", async ({ page }) => {
  await gotoApp(page);

  await page.getByRole("complementary").getByRole("button", { name: "New snippet" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Snippet title" }).fill("recipes/utils/greeting.js");
  await dialog
    .getByRole("textbox", { name: "Write or paste your code here..." })
    .fill("export const greeting = 'hello';");
  await dialog.getByRole("button", { name: "Create snippet" }).click();
  await expect(dialog).toBeHidden();

  const aside = page.getByRole("complementary");
  await expect(aside.getByRole("button", { name: "recipes", exact: true })).toBeVisible();
  await aside.getByRole("button", { name: "recipes", exact: true }).click();
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

  await page.getByRole("complementary").getByRole("button", { name: "welcome", exact: true }).click();
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

test("/es/app renders the app in Spanish", async ({ page }) => {
  await page.goto("/es/app");

  await expect(page.getByRole("button", { name: "Mi Espacio" })).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "Nuevo snippet" }),
  ).toBeVisible();
});

test("installed PWA disables the browser pull-to-refresh gesture", async ({ page }) => {
  await page.goto("/app");

  const pullToRefreshRule = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSMediaRule && rule.conditionText === "(display-mode: standalone)") {
          const styleRule = [...rule.cssRules].find(
            (nestedRule): nestedRule is CSSStyleRule => nestedRule instanceof CSSStyleRule,
          );
          return {
            selector: styleRule?.selectorText,
            overscrollBehaviorY: styleRule?.style.overscrollBehaviorY,
          };
        }
      }
    }
    return null;
  });

  expect(pullToRefreshRule).toEqual({
    selector: "html, body",
    overscrollBehaviorY: "none",
  });
});
