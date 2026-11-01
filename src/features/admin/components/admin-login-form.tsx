import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-login");

/** Staff sign-in form (Supabase email + password). Redirects to the dashboard on success. */
export function AdminLoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        setErrorMsg(error?.message || "Invalid email or password.");
        setIsSubmitting(false);
        return;
      }

      // Redirect to staff admin dashboard upon successful authentication
      void navigate({ to: "/admin" });
    } catch (cause) {
      logger.error("Sign-in request failed", cause);
      setErrorMsg("An unexpected connection error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-wider uppercase text-primary">
            Elite Dental Clinic
          </p>
          <h1 className="mt-1 text-2xl font-serif font-bold text-foreground">Staff Portal Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with authorized clinic credentials to manage appointment requests.
          </p>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-4 rounded bg-destructive/10 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-foreground">
              Staff Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="staff@drdebayansaha.in"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <p>
            Authorized staff access only. Staff user accounts are provisioned via the Supabase Auth
            Dashboard.
          </p>
          <a href="/" className="mt-2 inline-block text-primary hover:underline">
            ← Return to Clinic Website
          </a>
        </div>
      </div>
    </div>
  );
}
