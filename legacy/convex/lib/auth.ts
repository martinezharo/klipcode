import type { Id } from "../_generated/dataModel";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };

/**
 * The identity check every workspace function starts with. This is what
 * replaced Postgres row-level security: instead of a policy per table per
 * operation evaluated by the database, ownership is scoped once here and then
 * carried through the `by_owner*` indexes, so a query physically cannot read
 * another account's rows.
 *
 * Convex packs the user id into the identity subject as `<userId>|<sessionId>`;
 * only the first segment identifies the account.
 */
export async function requireUserId(ctx: AuthCtx): Promise<Id<"users">> {
  if (process.env.KLIPCODE_MIGRATED === "true") {
    throw new Error("KlipCode has moved. Reload the app and sign in again; unsynced changes remain on this device.");
  }
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated");
  }

  return identity.subject.split("|")[0] as Id<"users">;
}
