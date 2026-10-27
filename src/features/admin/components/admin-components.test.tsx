import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppointmentRecord } from "../types";
import { AppointmentsTable } from "./appointments-table";
import { NoteDialog } from "./note-dialog";

afterEach(cleanup);

const row = (over: Partial<AppointmentRecord> = {}): AppointmentRecord => ({
  id: "a1",
  created_at: "2026-10-27T01:30:00Z",
  name: "Asha Roy",
  phone: "+919147718046",
  email: null,
  preferred_date: "2026-11-05",
  preferred_time: "Evening",
  message: "Tooth pain",
  source: null,
  status: "new",
  treatment: "Not specified",
  notification: { status: "failed", attempts: 2, last_error: "UPSTREAM: timeout" },
  ...over,
});

describe("AppointmentsTable", () => {
  it("is labelled for assistive tech: caption, column headers, per-row status select", () => {
    render(
      <AppointmentsTable
        appointments={[row()]}
        isLoading={false}
        updatingId={null}
        onStatusChange={() => {}}
        onViewNote={() => {}}
      />,
    );
    expect(screen.getByRole("table", { name: /appointment requests/i })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getByLabelText("Status for Asha Roy")).toHaveValue("new");
    expect(screen.getByText(/failed \(2\/5\)/i)).toBeInTheDocument();
  });

  it("reports status changes and note clicks", () => {
    const onStatusChange = vi.fn();
    const onViewNote = vi.fn();
    render(
      <AppointmentsTable
        appointments={[row()]}
        isLoading={false}
        updatingId={null}
        onStatusChange={onStatusChange}
        onViewNote={onViewNote}
      />,
    );
    fireEvent.change(screen.getByLabelText("Status for Asha Roy"), {
      target: { value: "confirmed" },
    });
    expect(onStatusChange).toHaveBeenCalledWith("a1", "confirmed");

    fireEvent.click(screen.getByRole("button", { name: /view note from asha roy/i }));
    expect(onViewNote).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("shows loading and empty states", () => {
    const { rerender } = render(
      <AppointmentsTable
        appointments={[]}
        isLoading
        updatingId={null}
        onStatusChange={() => {}}
        onViewNote={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    rerender(
      <AppointmentsTable
        appointments={[]}
        isLoading={false}
        updatingId={null}
        onStatusChange={() => {}}
        onViewNote={() => {}}
      />,
    );
    expect(screen.getByText(/no appointments found/i)).toBeInTheDocument();
  });
});

describe("NoteDialog", () => {
  it("is a labelled modal dialog, closes on Escape, and returns focus to the opener", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && (
            <NoteDialog
              patientName="Asha Roy"
              message="Tooth pain"
              onClose={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: /patient note: asha roy/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
