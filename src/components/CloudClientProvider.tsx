"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CloudSessionContext,
  type CloudSession,
} from "@/hooks/useCloudSession";
import type { AccountUser } from "@/lib/types";
import { clearWorkspaceEncryptionKey } from "@/lib/encryptionKey";

async function csrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Authentication unavailable");
  const body = (await response.json()) as { csrfToken?: unknown };
  if (typeof body.csrfToken !== "string")
    throw new Error("Authentication unavailable");
  return body.csrfToken;
}

export function CloudClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (response.status === 503) {
        setConfigured(false);
        return;
      }
      if (!response.ok) throw new Error("Session unavailable");
      const session = (await response.json()) as {
        user?: {
          id?: string;
          name?: string | null;
          email?: string | null;
          image?: string | null;
        };
      } | null;
      setConfigured(true);
      if (session?.user?.id)
        localStorage.setItem("klipcode.offline-account", session.user.id);
      else localStorage.removeItem("klipcode.offline-account");
      setUser(
        session?.user?.id
          ? {
              id: session.user.id,
              name: session.user.name ?? null,
              email: session.user.email ?? null,
              imageUrl: session.user.image ?? null,
            }
          : null,
      );
    } catch {
      // The cached id grants access only to this device's working copy. The
      // backend always validates its cookie and the expected account header.
      const id = localStorage.getItem("klipcode.offline-account");
      if (id)
        setUser(
          (current) =>
            current ?? { id, name: null, email: null, imageUrl: null },
        );
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const channel = new BroadcastChannel("klipcode.session");
    channel.onmessage = () => void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearTimeout(initial);
      channel.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);
  const signIn = useCallback(async () => {
    const response = await fetch("/api/auth/signin/github", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken: await csrfToken(),
        callbackUrl: window.location.href,
      }),
    });
    if (!response.ok) throw new Error("Sign-in failed");
    const { url } = (await response.json()) as { url?: unknown };
    if (typeof url !== "string") throw new Error("Sign-in failed");
    window.location.assign(url);
  }, []);
  const signOut = useCallback(async () => {
    const response = await fetch("/api/auth/signout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({ csrfToken: await csrfToken() }),
    });
    if (!response.ok) throw new Error("Sign-out failed");
    localStorage.removeItem("klipcode.offline-account");
    clearWorkspaceEncryptionKey();
    setUser(null);
    const channel = new BroadcastChannel("klipcode.session");
    channel.postMessage("signed-out");
    channel.close();
  }, []);
  const session = useMemo<CloudSession>(
    () => ({ user, ready, configured, signIn, signOut }),
    [user, ready, configured, signIn, signOut],
  );
  return (
    <CloudSessionContext.Provider value={session}>
      {children}
    </CloudSessionContext.Provider>
  );
}
