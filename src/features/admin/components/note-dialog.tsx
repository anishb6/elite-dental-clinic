import { useEffect, useId, useRef } from "react";

type NoteDialogProps = { patientName: string; message: string; onClose: () => void };

/**
 * Modal showing a patient's note. Accessible: announced as a dialog, closes on Escape or backdrop
 * click, moves focus in on open and gives it back to the button that opened it on close.
 */
export function NoteDialog({ patientName, message, onClose }: NoteDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Keep the latest callback in a ref so the open/close effect below runs exactly once. If it
  // depended on `onClose` directly, a parent passing an inline function would re-run it on every
  // render and keep stealing focus (and "restore" it to the dialog's own button).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <h2 id={titleId} className="font-serif text-lg font-bold text-foreground">
          Patient Note: {patientName}
        </h2>
        <p className="mt-4 rounded bg-muted/50 p-3 text-sm text-foreground whitespace-pre-wrap">
          {message}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
