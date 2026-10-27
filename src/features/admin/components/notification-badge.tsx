import type { NotificationSummary } from "../types";

const MAX_ATTEMPTS = 5;

/** Email-delivery state of one booking, as recorded in the notification outbox. */
export function NotificationBadge({ notification }: { notification: NotificationSummary }) {
  switch (notification.status) {
    case "sent":
      return <span className="text-xs font-medium text-green-600">✓ Sent</span>;
    case "failed":
      return (
        <span
          className="cursor-help text-xs font-medium text-destructive"
          title={notification.last_error ?? `Failed after ${notification.attempts} attempts`}
        >
          ⚠ Failed ({notification.attempts}/{MAX_ATTEMPTS})
        </span>
      );
    case "pending":
    case "processing":
      return <span className="text-xs font-medium text-amber-600">⏳ Pending</span>;
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}
