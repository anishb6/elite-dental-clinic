type AdminHeaderProps = {
  email: string | undefined;
  /** Disables the outbox button (no session yet, or signed in without staff access). */
  outboxDisabled: boolean;
  isProcessingOutbox: boolean;
  onProcessOutbox: () => void;
  onSignOut: () => void;
};

export function AdminHeader({
  email,
  outboxDisabled,
  isProcessingOutbox,
  onProcessOutbox,
  onSignOut,
}: AdminHeaderProps) {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold text-foreground">Elite Dental Clinic</h1>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Staff Portal
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Logged in as {email ?? "…"}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onProcessOutbox}
            disabled={isProcessingOutbox || outboxDisabled}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {isProcessingOutbox ? (
              "Processing Retries…"
            ) : (
              <>
                <span aria-hidden="true">🔄</span> Process Notification Outbox
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
