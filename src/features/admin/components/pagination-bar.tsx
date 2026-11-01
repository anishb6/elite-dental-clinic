type PaginationBarProps = {
  page: number;
  totalPages: number;
  shown: number;
  totalCount: number;
  /** Disables both buttons while a page is loading. */
  busy: boolean;
  onPageChange: (page: number) => void;
};

const BUTTON_CLASSES =
  "rounded border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50";

export function PaginationBar({
  page,
  totalPages,
  shown,
  totalCount,
  busy,
  onPageChange,
}: PaginationBarProps) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
    >
      <div aria-live="polite">
        Showing {shown} of {totalCount} total bookings
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || busy}
          onClick={() => onPageChange(page - 1)}
          className={BUTTON_CLASSES}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || busy}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className={BUTTON_CLASSES}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
