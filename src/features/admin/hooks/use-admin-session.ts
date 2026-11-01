import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-session");

type AdminSession = { token: string; email: string };

/**
 * Tracks the Supabase Auth session for the staff portal. Sends the visitor to the login page
 * whenever there is no session (including when the session can't be read at all), and keeps
 * `token` current when Supabase refreshes it.
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

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch((cause: unknown) => {
        logger.error("Could not read the auth session", cause);
        apply(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => apply(next));

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (cause) {
      // Leave the portal regardless; a failed remote sign-out must not trap staff on this page.
      logger.error("Sign-out request failed", cause);
    }
    void navigate({ to: "/admin/login" });
  }, [navigate]);

  return { session, signOut };
}
