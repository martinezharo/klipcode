import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  base64ToBytes,
  CURRENT_CRYPTO_VERSION,
  decryptString,
  importAesKey,
} from "../src/lib/crypto";
import { aside, asideRow, gotoApp } from "./helpers";

/**
 * Cloud-sync tests against the local Supabase stack (pnpm e2e:sync:setup, then
 * pnpm test:e2e:sync). They cover the riskiest product surface: losing or
 * leaking data between devices. Each test signs up a throwaway user, so tests
 * are independent and parallel-safe.
 *
 * The app only offers GitHub OAuth in the UI, so tests sign in by injecting the
 * session where supabase-js persists it: the `sb-<host>-auth-token`
 * localStorage key, holding the JSON-serialized Session. The welcome seed only
 * exists for anonymous visitors (a signed-in first load never seeds), so tests
 * that need content create it via the UI.
 */

const supabaseUrl = process.env.E2E_SYNC_SUPABASE_URL!;
const anonKey = process.env.E2E_SYNC_ANON_KEY!;
const serviceRoleKey = process.env.E2E_SYNC_SERVICE_ROLE_KEY!;

// Belt and braces on top of the config's check: these tests write and delete
// rows, and must never run against a non-local Supabase project.
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl)) {
  throw new Error(`sync tests require a local Supabase URL, got "${supabaseUrl}"`);
}

// Service-role client, bypasses RLS: used to observe what actually landed in
// the cloud (ciphertext, deleted_at, row presence) from outside the app.
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createTestUser(): Promise<Session> {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Local auth is configured with confirmations off, so signUp returns a
  // ready-to-use session.
  const { data, error } = await client.auth.signUp({
    email: `e2e-${crypto.randomUUID()}@klipcode.test`,
    password: "klipcode-e2e-password",
  });
  if (error || !data.session) {
    throw new Error(`test user signup failed: ${error?.message ?? "no session returned"}`);
  }
  return data.session;
}

/**
 * Make the context signed-in from its next navigation onwards, by planting the
 * session where supabase-js persists it (same storageKey derivation).
 */
async function signIn(context: BrowserContext, session: Session) {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [storageKey, JSON.stringify(session)] as const
  );
}

async function createSnippet(page: Page, title: string, code: string) {
  await aside(page).getByRole("button", { name: "New snippet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Snippet title" }).fill(title);
  // The code field is a CodeMirror editor, only reachable by role + name.
  await dialog.getByRole("textbox", { name: "Write or paste your code here..." }).fill(code);
  await dialog.getByRole("button", { name: "Create snippet" }).click();
  await expect(dialog).toBeHidden();
}

/** Rows in `snippets` owned by the user, as the cloud stores them. */
async function fetchCloudSnippets(userId: string) {
  const { data, error } = await admin
    .from("snippets")
    .select("id, title, code, language, crypto_version, deleted_at")
    .eq("owner_id", userId);
  if (error) throw error;
  return data;
}

test("signing in claims anonymous work and uploads it as ciphertext", async ({ page }) => {
  // First visit is anonymous: the welcome seed ("welcome" folder + "klipcode"
  // snippet) lands in IndexedDB only. The seeded snippet lives inside the
  // welcome folder and is pinned to Home (not to the aside), so it shows on the
  // main view — not directly in the sidebar. Assert the welcome folder in the
  // aside as the direct, reliable signal that the seed happened.
  await gotoApp(page);
  await expect(
    asideRow(page, "welcome")
  ).toBeVisible();

  // Sign in and reload: the account claims the anonymous records and pushes
  // them to the cloud.
  const session = await createTestUser();
  await signIn(page.context(), session);
  await page.reload();
  await expect(page.getByRole("button", { name: "My Space" })).toBeVisible();

  await expect
    .poll(async () => (await fetchCloudSnippets(session.user.id)).length, { timeout: 30_000 })
    .toBe(1);

  const [snippet] = await fetchCloudSnippets(session.user.id);
  expect(snippet.crypto_version).toBe(CURRENT_CRYPTO_VERSION);
  // What crossed the wire must be ciphertext, not the seed's plaintext.
  expect(snippet.title).not.toBe("klipcode");
  expect(snippet.code).not.toContain("Welcome to KlipCode");

  const { data: folders, error } = await admin
    .from("folders")
    .select("name, crypto_version")
    .eq("owner_id", session.user.id);
  if (error) throw error;
  expect(folders).toHaveLength(1);
  expect(folders![0].crypto_version).toBe(CURRENT_CRYPTO_VERSION);
  expect(folders![0].name).not.toBe("welcome");

  // And it must decrypt back to the original with the account's DEK, fetched
  // the same way the app does it.
  const dekResponse = await page.request.get("/api/crypto/dek", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  expect(dekResponse.ok()).toBeTruthy();
  const { dek } = (await dekResponse.json()) as { dek: string };
  const key = await importAesKey(base64ToBytes(dek));

  expect(await decryptString(key, snippet.title)).toBe("klipcode");
  expect(await decryptString(key, snippet.code)).toContain("Welcome to KlipCode");
  expect(await decryptString(key, folders![0].name)).toBe("welcome");
});

test("a snippet created on device A appears decrypted on device B", async ({ browser }) => {
  const session = await createTestUser();

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    await signIn(contextA, session);
    const pageA = await contextA.newPage();
    await gotoApp(pageA);

    await createSnippet(pageA, "greeting.js", "console.log('hello from device A');");

    // Wait until the row is in the cloud before device B signs in.
    await expect
      .poll(async () => (await fetchCloudSnippets(session.user.id)).length, { timeout: 30_000 })
      .toBe(1);

    await signIn(contextB, session);
    const pageB = await contextB.newPage();
    await gotoApp(pageB);

    // Device B pulls on sign-in and must show the decrypted snippet.
    await expect(asideRow(pageB, "greeting.js")).toBeVisible({
      timeout: 15_000,
    });

    await asideRow(pageB, "greeting.js").click();
    await pageB.getByRole("button", { name: "Copy code" }).first().click();
    const clipboard = await pageB.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe("console.log('hello from device A');");
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("trash and permanent deletion propagate from device A to device B", async ({ browser }) => {
  const session = await createTestUser();

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    await signIn(contextA, session);
    const pageA = await contextA.newPage();
    await gotoApp(pageA);

    await createSnippet(pageA, "doomed.js", "console.log('delete me');");

    await expect
      .poll(async () => (await fetchCloudSnippets(session.user.id)).length, { timeout: 30_000 })
      .toBe(1);

    // Device B syncs the snippet down BEFORE the deletion, so we exercise the
    // real remote-deletion path (a synced local record being reconciled away),
    // not just an empty pull.
    await signIn(contextB, session);
    const pageB = await contextB.newPage();
    await gotoApp(pageB);
    await expect(asideRow(pageB, "doomed.js")).toBeVisible({
      timeout: 15_000,
    });

    // Device A: soft delete (move to trash) → the cloud row survives with
    // deleted_at set.
    await asideRow(pageA, "doomed.js").click({ button: "right" });
    await pageA.getByRole("menuitem", { name: "Delete", exact: true }).click();

    await expect
      .poll(async () => (await fetchCloudSnippets(session.user.id))[0]?.deleted_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();

    // Device A: empty the trash → the queued tombstone deletes the cloud row.
    await aside(pageA).getByRole("button", { name: "Trash" }).click();
    await pageA.getByRole("main").getByRole("button", { name: "Empty trash" }).click();
    await pageA.getByRole("alertdialog").getByRole("button", { name: "Empty trash" }).click();

    await expect
      .poll(async () => (await fetchCloudSnippets(session.user.id)).length, { timeout: 30_000 })
      .toBe(0);

    // Device B: the next pull must remove its local copy (a previously synced,
    // clean record that vanished from the cloud). Reloading triggers the
    // sign-in reconcile.
    await pageB.reload();
    await expect(pageB.getByRole("button", { name: "My Space" })).toBeVisible();
    await expect(asideRow(pageB, "doomed.js")).toBeHidden({
      timeout: 15_000,
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
