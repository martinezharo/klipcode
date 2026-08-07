import { useEffect, useRef, useState } from "react";
import { useCloudSession } from "@/hooks/useCloudSession";
import { clearOwnedData } from "@/lib/db";
import { clearWorkspaceEncryptionKey } from "@/lib/encryptionKey";
import { reconcileWorkspace } from "@/lib/sync";
import type { Dictionary } from "@/i18n";

interface UseAuthOptions {
  copy: Dictionary;
  refreshWorkspace: () => void;
  onReconciled: (syncedSnippetIds: string[]) => void;
}

export function useAuth({ copy, refreshWorkspace, onReconciled }: UseAuthOptions) {
  const session = useCloudSession();
  const { user, ready: authReady, configured: cloudConfigured } = session;

  // Pending flags for the auth actions, which round-trip to GitHub and can leave
  // the UI looking frozen otherwise (sign-in redirects off-page).
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>(
    cloudConfigured ? copy.auth.guestMode : copy.auth.notConfigured
  );

  const accountSyncInFlightRef = useRef(false);
  const accountSyncUserIdRef = useRef<string | null>(null);
  const accountSyncFollowUpRef = useRef(false);
  const [accountSyncGeneration, setAccountSyncGeneration] = useState(0);
  // Refs ensure async callbacks in effects always see the latest values
  const refreshRef = useRef(refreshWorkspace);
  refreshRef.current = refreshWorkspace;
  const onReconciledRef = useRef(onReconciled);
  onReconciledRef.current = onReconciled;
  const copyRef = useRef(copy);
  copyRef.current = copy;
  // Distinguishes "signed out all along" (initial render) from "just signed
  // out", which is the only case that needs the workspace re-read.
  const previousUserIdRef = useRef<string | null>(null);

  const userId = user?.id ?? null;
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (userId === null) {
      if (
        accountSyncInFlightRef.current &&
        accountSyncUserIdRef.current !== null
      ) {
        accountSyncFollowUpRef.current = true;
      }
      const hadUser = previousUserIdRef.current !== null;
      previousUserIdRef.current = null;
      setAccountMessage(cloudConfigured ? copyRef.current.auth.guestMode : copyRef.current.auth.notConfigured);
      if (hadUser) {
        refreshRef.current();
      }
      return;
    }

    // A session can change while the previous account is still reconciling. Do
    // not mark the new account as synced before its turn: the completion handler
    // below will retrigger this effect once the in-flight reconciliation releases
    // the shared IndexedDB/key state.
    if (accountSyncInFlightRef.current) {
      if (accountSyncUserIdRef.current !== userId) {
        accountSyncFollowUpRef.current = true;
      }
      return;
    }

    const alreadySyncedThisUser = previousUserIdRef.current === userId;
    previousUserIdRef.current = userId;

    if (alreadySyncedThisUser) return;

    setAccountMessage(copyRef.current.auth.signedIn);

    let cancelled = false;
    accountSyncInFlightRef.current = true;
    accountSyncUserIdRef.current = userId;
    setAccountMessage(copyRef.current.auth.syncingSession);

    void (async () => {
      try {
        const result = await reconcileWorkspace(userId);
        if (cancelled) return;
        refreshRef.current();
        onReconciledRef.current(result.syncedSnippetIds);
        setAccountMessage(copyRef.current.auth.syncedSession);
      } catch {
        if (cancelled) return;
        setAccountMessage(copyRef.current.auth.syncFailed);
      } finally {
        accountSyncInFlightRef.current = false;
        accountSyncUserIdRef.current = null;
        const needsFollowUp =
          accountSyncFollowUpRef.current || currentUserIdRef.current !== userId;
        accountSyncFollowUpRef.current = false;
        if (needsFollowUp) {
          previousUserIdRef.current = null;
          setAccountSyncGeneration((generation) => generation + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, cloudConfigured, userId, accountSyncGeneration]);

  async function handleGitHubSignIn() {
    if (!cloudConfigured || signingIn) return;

    // Stays true through the off-page redirect to GitHub; only an error (which
    // keeps us on the page) clears it so the button can be retried.
    setSigningIn(true);
    setAccountMessage(copy.auth.signingIn);

    try {
      await session.signIn();
    } catch {
      setSigningIn(false);
      setAccountMessage(copy.auth.syncFailed);
    }
  }

  async function handleSignOut() {
    if (!cloudConfigured || signingOut) return;
    setSigningOut(true);
    setAccountMessage(copy.auth.signingOut);
    try {
      const signedOutUserId = userId;
      await session.signOut();
      // Wipe this account's local data so it isn't readable on a shared machine.
      // Synced data comes back from the cloud on the next sign-in.
      if (signedOutUserId) await clearOwnedData(signedOutUserId);
      // The in-memory encryption key goes with it.
      clearWorkspaceEncryptionKey();
      setAccountMessage(cloudConfigured ? copy.auth.guestMode : copy.auth.notConfigured);
      refreshRef.current();
    } finally {
      setSigningOut(false);
    }
  }

  return {
    user,
    authReady,
    accountMessage,
    setAccountMessage,
    cloudConfigured,
    signingIn,
    signingOut,
    handleGitHubSignIn,
    handleSignOut,
  };
}
