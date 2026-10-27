/**
 * Cloudflare Turnstile server-side verification service.
 *
 * Verifies the `cf-turnstile-response` token against Cloudflare's verification endpoint.
 *
 * Configuration:
 * - When `TURNSTILE_SECRET_KEY` is not set, verification is bypassed ONLY in an explicit local
 *   development / test run (NODE_ENV=development|test or VITEST). Anywhere else - production, or an
 *   unknown/unset NODE_ENV - a missing secret fails closed with a CONFIG error.
 * - Cloudflare's dummy tokens are honoured only in those same explicit dev/test runs.
 * - When the secret is set, every token is verified against Cloudflare.
 */
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("turnstile");
const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;

// Cloudflare dummy tokens - usable only in explicit dev/test runs (see `verifyTurnstileToken`).
const DUMMY_PASS_TOKEN = "XXXX.DUMMY.TOKEN.PASSXXXX";
const DUMMY_PASS_SITE_TOKEN = "1x00000000000000000000AA";
const DUMMY_FAIL_TOKEN = "XXXX.DUMMY.TOKEN.FAILXXXX";
const DUMMY_FAIL_SITE_TOKEN = "2x00000000000000000000AA";

export type TurnstileVerifyResult = {
  success: boolean;
  errorCodes?: string[] | undefined;
};

/** Checks whether the execution environment is an explicit local development or test suite run. */
function isExplicitDevOrTest(): boolean {
  if (process.env["NODE_ENV"] === "production") {
    return false;
  }
  return (
    process.env["NODE_ENV"] === "test" ||
    process.env["NODE_ENV"] === "development" ||
    Boolean(process.env["VITEST"])
  );
}

export async function verifyTurnstileToken(
  token?: string | null,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env["TURNSTILE_SECRET_KEY"];

  // In production, missing TURNSTILE_SECRET_KEY must fail closed to prevent unprotected submissions.
  // Any bypass is strictly limited to explicit local development or test environments.
  if (!secretKey || secretKey.trim() === "") {
    if (isExplicitDevOrTest()) {
      return { success: true };
    }

    logger.error(
      "Security verification failed-closed: TURNSTILE_SECRET_KEY is missing in production",
    );
    throw new AppError(
      "CONFIG",
      "Server security configuration error: TURNSTILE_SECRET_KEY is required in production",
      {
        status: 500,
        userMessage: "Security verification service is temporarily unavailable on the server.",
      },
    );
  }

  if (!token || token.trim() === "") {
    logger.warn("Turnstile verification failed: missing token");
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  // Cloudflare's documented dummy tokens are a test-only shortcut. They are honoured ONLY in an
  // explicit local development / test run. In every other environment (including production with a
  // real secret) they fall through to Cloudflare, which rejects them - otherwise anyone could send
  // the well-known "pass" token and skip the bot challenge entirely.
  if (isExplicitDevOrTest()) {
    if (token === DUMMY_PASS_TOKEN || token === DUMMY_PASS_SITE_TOKEN) {
      return { success: true };
    }
    if (token === DUMMY_FAIL_TOKEN || token === DUMMY_FAIL_SITE_TOKEN) {
      return { success: false, errorCodes: ["invalid-input-response"] };
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp && remoteIp !== "local") {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error("Turnstile API upstream error", { status: response.status });
      throw new AppError(
        "UPSTREAM",
        `Cloudflare Turnstile verification returned ${response.status}`,
        {
          status: 502,
          userMessage: "Bot verification service temporarily unavailable.",
        },
      );
    }

    const outcome = (await response.json()) as { success: boolean; "error-codes"?: string[] };
    return {
      success: outcome.success,
      errorCodes: outcome["error-codes"],
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Turnstile verification network failure", {
      message: error instanceof Error ? error.message : "Unknown",
    });
    return { success: false, errorCodes: ["network-failure"] };
  }
}
