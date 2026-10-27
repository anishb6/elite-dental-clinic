/**
 * Transactional e-mail via Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Server-only: reads secrets through `getNotifyEnv()`.
 */
import { getNotifyEnv } from "@/config/env.server";
import { AppError } from "@/lib/errors";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 8_000;

export type EmailMessage = { subject: string; html: string };

export async function sendEmail({ subject, html }: EmailMessage): Promise<void> {
  const env = getNotifyEnv();

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.from, to: env.recipients, subject, html }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new AppError("UPSTREAM", "Could not reach the Resend API", {
      status: 502,
      cause,
      userMessage: "We couldn't send the notification right now.",
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError("UPSTREAM", `Resend responded ${response.status}: ${detail}`, {
      status: 502,
      userMessage: "We couldn't send the notification right now.",
    });
  }
}
