import { useEffect, useRef, useState } from "react";
import { publicEnv } from "@/config/env.public";
import { createLogger } from "@/lib/logger";

const logger = createLogger("turnstile");

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset?: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile bot challenge for a form.
 *
 * Enforced only when `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY` is set. While enforced, `ready` stays
 * false until the widget has produced a token. Tokens are single-use, so call `reset()` after every
 * submit to request a fresh challenge (this flips `ready` back to false until it is solved).
 *
 * Usage: attach `containerRef` to an empty div, read `getToken()` at submit time.
 */
export function useTurnstile() {
  const siteKey = publicEnv.turnstileSiteKey;
  const required = Boolean(siteKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | undefined>(undefined);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(!required);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    function dropToken() {
      tokenRef.current = undefined;
      setReady(false);
    }

    function renderWidget() {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current || !siteKey) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            tokenRef.current = token;
            setReady(true);
          },
          "expired-callback": dropToken,
          "error-callback": dropToken,
          theme: "auto",
        });
      } catch (cause) {
        // The form stays disabled (no token), so make the reason visible in the logs.
        logger.warn("Turnstile widget failed to render", cause);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        // Script tag exists but hasn't finished loading (e.g. a second mount): render once it does.
        existing.addEventListener("load", renderWidget, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      const id = widgetIdRef.current;
      if (!id) return;
      try {
        window.turnstile?.remove?.(id);
      } catch (cause) {
        logger.warn("Turnstile widget could not be removed", cause);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  /** Tokens are single-use: drop the spent one and ask Cloudflare for a fresh challenge. */
  function reset() {
    if (!required) return;
    tokenRef.current = undefined;
    setReady(false);
    const id = widgetIdRef.current;
    if (!id) return;
    try {
      window.turnstile?.reset?.(id);
    } catch (cause) {
      logger.warn("Turnstile widget could not be reset", cause);
    }
  }

  return { required, ready, containerRef, getToken: () => tokenRef.current, reset };
}
