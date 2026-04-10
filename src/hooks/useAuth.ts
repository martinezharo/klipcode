import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { reconcileWorkspace } from "@/lib/sync";
import type { Dictionary } from "@/i18n";

interface UseAuthOptions {
  copy: Dictionary;
  refreshWorkspace: () => void;
  onReconciled: (syncedSnippetIds: string[]) => void;
}

export function useAuth({ copy, refreshWorkspace, onReconciled }: UseAuthOptions) {
  const supabase = getSupabaseBrowserClient();
  const supabaseConfigured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>(
    supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured
  );

  const accountSyncInFlightRef = useRef(false);
  // Refs ensure async callbacks in effects always see the latest values
  const refreshRef = useRef(refreshWorkspace);
  refreshRef.current = refreshWorkspace;
  const onReconciledRef = useRef(onReconciled);
  onReconciledRef.current = onReconciled;

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    async function syncAccount(nextUser: User) {
      if (!supabaseConfigured || accountSyncInFlightRef.current) return;
      accountSyncInFlightRef.current = true;
      setAccountMessage(copy.auth.syncingSession);

      try {
        const result = await reconcileWorkspace(nextUser.id);
        refreshRef.current();
        onReconciledRef.current(result.syncedSnippetIds);
        setAccountMessage(copy.auth.syncedSession);
      } catch {
        setAccountMessage(copy.auth.syncFailed);
      } finally {
        accountSyncInFlightRef.current = false;
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAccountMessage(copy.auth.signedIn);
        void syncAccount(nextUser);
      } else if (supabaseConfigured) {
        setAccountMessage(copy.auth.localMode);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAccountMessage(copy.auth.signedIn);
        void syncAccount(nextUser);
        return;
      }

      setAccountMessage(supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured);
      refreshRef.current();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    copy.auth.localMode,
    copy.auth.notConfigured,
    copy.auth.signedIn,
    copy.auth.syncFailed,
    copy.auth.syncedSession,
    copy.auth.syncingSession,
    supabase,
    supabaseConfigured,
  ]);

  async function handleGitHubSignIn() {
    if (!supabase) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href },
    });

    if (error) setAccountMessage(copy.auth.syncFailed);
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setAccountMessage(supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured);
    refreshRef.current();
  }

  return {
    user,
    authReady,
    accountMessage,
    setAccountMessage,
    supabase,
    supabaseConfigured,
    handleGitHubSignIn,
    handleSignOut,
  };
}
