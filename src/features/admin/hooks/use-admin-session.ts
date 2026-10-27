import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminSession = { token: string; email: string };

/**
 * Tracks the Supabase Auth session for the staff portal. Sends the visitor to the login page
 * whenever there is no session, and keeps `token` current when Supabase refreshes it.
 */
export function useAdminSession() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    function apply(next: { access_token: string; user: { email?: string | undefined } } | null) {
      if (!next) {
        setSession(null);
        void navigate({ to: "/admin/login" });
        return;
      }
      setSession({ token: next.access_token, email: next.user.email ?? "Clinic Staff" });
    }

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => apply(next));

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/admin/login" });
  }, [navigate]);

  return { session, signOut };
}
