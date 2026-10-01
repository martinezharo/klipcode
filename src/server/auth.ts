import { Auth, type AuthConfig } from "@auth/core";
import GitHub from "@auth/core/providers/github";
import { D1Adapter } from "@auth/d1-adapter";
import type { AccountUser } from "@/lib/types";
import { backendEnv } from "./env";

export function sessionCookieName(url: string): string {
  return new URL(url).protocol === "https:"
    ? "__Host-klipcode.session"
    : "klipcode.session";
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Browser writes must come from the app's own origin. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

function adapter(db: D1Database) {
  const base = D1Adapter(db);
  return {
    ...base,
    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      const stored = await base.createSession!({
        ...session,
        sessionToken: await hashSessionToken(session.sessionToken),
      });
      return { ...stored, sessionToken: session.sessionToken };
    },
    async getSessionAndUser(token: string) {
      const result = await base.getSessionAndUser!(
        await hashSessionToken(token),
      );
      return result
        ? { ...result, session: { ...result.session, sessionToken: token } }
        : null;
    },
    async updateSession(session: {
      sessionToken: string;
      expires?: Date;
      userId?: string;
    }) {
      const hash = await hashSessionToken(session.sessionToken);
      if (session.expires)
        await db
          .prepare("UPDATE sessions SET expires=? WHERE sessionToken=?")
          .bind(session.expires.toISOString(), hash)
          .run();
      const result = await base.getSessionAndUser!(hash);
      return result
        ? { ...result.session, sessionToken: session.sessionToken }
        : null;
    },
    async deleteSession(token: string) {
      await base.deleteSession!(await hashSessionToken(token));
    },
  };
}

export function authConfig(env: CloudflareEnv, url: string): AuthConfig {
  const secure = new URL(url).protocol === "https:";
  return {
    adapter: adapter(env.DB),
    secret: env.AUTH_SECRET,
    basePath: "/api/auth",
    trustHost: true,
    providers: [
      GitHub({
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
      }),
    ],
    session: {
      strategy: "database",
      maxAge: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    cookies: {
      sessionToken: {
        name: sessionCookieName(url),
        options: { httpOnly: true, sameSite: "lax", path: "/", secure },
      },
    },
    callbacks: {
      session({ session, user }) {
        return { ...session, user: { ...session.user, id: user.id } };
      },
    },
  };
}

export async function handleAuth(request: Request): Promise<Response> {
  const env = await backendEnv();
  if (!env.AUTH_SECRET || !env.AUTH_GITHUB_ID || !env.AUTH_GITHUB_SECRET) {
    return Response.json(
      { error: "authentication unavailable" },
      { status: 503 },
    );
  }
  if (
    env.AUTH_URL &&
    new URL(request.url).origin !== new URL(env.AUTH_URL).origin
  ) {
    return Response.json(
      { error: "invalid authentication origin" },
      { status: 403 },
    );
  }
  const response = await Auth(request, authConfig(env, request.url));
  response.headers.set("cache-control", "private, no-store");
  return response;
}

/** A single indexed join; cookie tokens are hashed before looking them up. */
export async function readSessionUser(
  request: Request,
  db: D1Database,
): Promise<AccountUser | null> {
  const name = sessionCookieName(request.url);
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;
  let token: string;
  try {
    token = decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
  if (!token || token.length > 512) return null;
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.image AS imageUrl
    FROM sessions s JOIN users u ON u.id=s.userId
    WHERE s.sessionToken=? AND s.expires>?`,
    )
    .bind(await hashSessionToken(token), new Date().toISOString())
    .first<AccountUser>();
}

export type ViewerResult =
  | { status: "authenticated"; userId: string }
  | { status: "anonymous" }
  | { status: "unavailable" };
export async function readViewerId(request: Request): Promise<ViewerResult> {
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return { status: "anonymous" };
  try {
    const env = await backendEnv();
    const user = await readSessionUser(request, env.DB);
    return user
      ? { status: "authenticated", userId: user.id }
      : { status: "anonymous" };
  } catch {
    return { status: "unavailable" };
  }
}
