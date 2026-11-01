import type { ReactNode } from "react";

type AlertBannerProps = {
  /** `error` is announced assertively (`role="alert"`); `success` politely (`role="status"`). */
  tone: "success" | "error";
  children: ReactNode;
  /** Optional trailing text button, e.g. "Dismiss" or "Try again". */
  action?: { label: string; onClick: () => void };
};

const TONE_CLASSES = {
  success: "bg-primary/10 text-primary",
  error: "bg-destructive/10 text-destructive",
} as const;

/** Inline notice used for retry results and request failures on the staff dashboard. */
export function AlertBanner({ tone, children, action }: AlertBannerProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-6 flex items-center justify-between rounded p-3 text-sm ${TONE_CLASSES[tone]}`}
    >
      <span>{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs font-bold hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
