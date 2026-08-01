#!/usr/bin/env node
/**
 * One-off import of the old Supabase backend into Convex.
 *
 * Copies, never re-encrypts. The master key that wraps each per-user DEK never
 * moved (it is still the Cloudflare Worker secret), so a user's `wrapped_dek`
 * stays valid here and their record ciphertext transfers byte for byte. Nothing
 * is decrypted at any point, which is why this cannot corrupt data.
 *
 * Accounts are matched on the GitHub numeric id, which Supabase keeps in
 * `identities[].provider_id` and Convex Auth keys `authAccounts` on. Users who
 * never signed in to Convex are pre-created, so their first GitHub sign-in
 * lands on the user that already owns their imported records.
 *
 * Usage:
 *   node scripts/migrate-supabase-to-convex.mjs --dry-run
 *   node scripts/migrate-supabase-to-convex.mjs
 *
 * Reads SECRET_KEY (Supabase secret/service_role key) and SUPABASE_URL from the
 * environment. Idempotent: re-running upserts, so an interrupted run resumes.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://fkopektealbfgdpornlx.supabase.co";
const SECRET_KEY = process.env.SECRET_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SECRET_KEY) {
  console.error("SECRET_KEY is not set (Supabase secret key).");
  process.exit(1);
}

const headers = { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` };

/** Never print a full address: this handles other people's accounts. */
const maskEmail = (email) => (email ? email.replace(/^(.).*(@.*)$/, "$1***$2") : "(no email)");

async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${await response.text()}`);
  return response.json();
}

async function listUsers() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!response.ok) throw new Error(`admin/users -> ${response.status}`);
  const { users } = await response.json();

  // The list endpoint omits `identities`, and that is where the GitHub id lives,
  // so each user has to be fetched individually.
  return Promise.all(
    users.map(async (user) => {
      const detail = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { headers });
      if (!detail.ok) throw new Error(`admin/users/${user.id} -> ${detail.status}`);
      return detail.json();
    })
  );
}

function githubIdOf(user) {
  const identity = (user.identities ?? []).find((i) => i.provider === "github");
  const raw =
    identity?.provider_id ??
    identity?.identity_data?.provider_id ??
    user.user_metadata?.provider_id ??
    user.user_metadata?.sub;
  return raw ? String(raw) : null;
}

const toFolder = (row) => ({
  clientId: row.id,
  name: row.name,
  parentId: row.parent_id ?? null,
  isPinnedAside: !!row.is_pinned_aside,
  isPinnedHome: !!row.is_pinned_home,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at ?? null,
  cryptoVersion: row.crypto_version ?? 0,
});

const toSnippet = (row) => ({
  clientId: row.id,
  folderId: row.folder_id ?? null,
  title: row.title,
  code: row.code,
  language: row.language,
  isPinnedAside: !!row.is_pinned_aside,
  isPinnedHome: !!row.is_pinned_home,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at ?? null,
  cryptoVersion: row.crypto_version ?? 0,
});

function groupByOwner(rows, map) {
  const byOwner = new Map();
  for (const row of rows) {
    const bucket = byOwner.get(row.owner_id) ?? [];
    bucket.push(map(row));
    byOwner.set(row.owner_id, bucket);
  }
  return byOwner;
}

async function main() {
  const [users, folderRows, snippetRows, keyRows] = await Promise.all([
    listUsers(),
    rest("folders?select=*"),
    rest("snippets?select=*"),
    rest("user_keys?select=user_id,wrapped_dek"),
  ]);

  const foldersByOwner = groupByOwner(folderRows, toFolder);
  const snippetsByOwner = groupByOwner(snippetRows, toSnippet);
  const dekByUser = new Map(keyRows.map((row) => [row.user_id, row.wrapped_dek]));

  console.log(
    `Supabase: ${users.length} users, ${folderRows.length} folders, ` +
      `${snippetRows.length} snippets, ${keyRows.length} wrapped keys\n`
  );

  let importedFolders = 0;
  let importedSnippets = 0;
  const problems = [];

  for (const user of users) {
    const githubId = githubIdOf(user);
    const folders = foldersByOwner.get(user.id) ?? [];
    const snippets = snippetsByOwner.get(user.id) ?? [];
    const label = `${maskEmail(user.email)} (${folders.length}f/${snippets.length}s)`;

    if (!githubId) {
      problems.push(`${label}: no GitHub identity, cannot be matched to a Convex account`);
      continue;
    }

    const payload = {
      githubId,
      email: user.email ?? null,
      name: user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? null,
      image: user.user_metadata?.avatar_url ?? null,
      wrappedDek: dekByUser.get(user.id) ?? null,
      folders,
      snippets,
    };

    if (DRY_RUN) {
      console.log(
        `would import ${label} github:${githubId} dek:${payload.wrappedDek ? "yes" : "none"}`
      );
      continue;
    }

    const { stdout } = await run(
      "npx",
      ["convex", "run", "--prod", "migrations:importAccount", JSON.stringify(payload)],
      { maxBuffer: 64 * 1024 * 1024 }
    );

    // `convex run` pretty-prints the return value over several lines, and may
    // precede it with log output, so parse from the first brace onwards.
    const start = stdout.indexOf("{");
    if (start === -1) throw new Error(`unexpected convex run output:\n${stdout}`);
    const result = JSON.parse(stdout.slice(start));
    importedFolders += result.importedFolders;
    importedSnippets += result.importedSnippets;

    const status = result.skipped
      ? `SKIPPED (${result.skipped})`
      : `${result.importedFolders}f/${result.importedSnippets}s imported`;
    console.log(`${label} ${result.created ? "[new account]" : "[existing]"} -> ${status}`);
  }

  if (!DRY_RUN) {
    console.log(`\nTotal imported: ${importedFolders} folders, ${importedSnippets} snippets`);
  }

  if (problems.length > 0) {
    console.log("\nNeeds attention:");
    for (const problem of problems) console.log(` - ${problem}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
