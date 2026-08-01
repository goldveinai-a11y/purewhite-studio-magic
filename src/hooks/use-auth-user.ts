import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthUser = {
  id: string;
  email: string | null;
};

/**
 * Tracks the current Supabase auth session and keeps it live.
 *
 * `onAuthStateChange` fires on sign-in, sign-out, token refresh, and — most
 * importantly for the "came back 5 days later / on another device" case — on
 * the initial session restore when the page loads with a stored session. So a
 * returning Pro user is recognized automatically as soon as this mounts,
 * without any manual re-login, as long as their refresh token is still valid.
 * When it isn't, `user` is null and the navbar shows "Sign in" so they can get
 * back into the exact same account (and their Pro entitlement) from anywhere.
 */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
