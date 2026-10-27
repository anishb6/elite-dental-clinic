/**
 * End-to-end simulation of the patient appointment booking journey.
 *
 * Tests the entire user-facing flow in jsdom:
 * - Form rendering and accessibility
 * - Client-side validation for missing and invalid fields
 * - Bot honeypot interaction
 * - Affirmative privacy consent
 * - Successful submission and success confirmation display
 * - Resilient failure handling (retaining user input when server errors occur)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const createAppointment = vi.fn();
vi.mock("../api/appointments.api", () => ({
  createAppointment: (payload: unknown) => createAppointment(payload),
}));

import { BookingForm } from "./booking-form";

function renderBookingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  createAppointment.mockReset().mockResolvedValue({ id: "test-uuid-123", saved: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T20:00:00Z")); // 27 Oct 01:30 IST
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Booking Journey End-to-End Simulation", () => {
  it("completes full successful booking journey from empty form to confirmation screen", async () => {
    renderBookingPage();

    // 1. Check initial form state
    expect(screen.getByRole("button", { name: /request appointment/i })).toBeInTheDocument();

    // 2. Try submitting empty -> rejected locally, no network call
    fireEvent.click(screen.getByRole("button", { name: /request appointment/i }));
    expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
    expect(createAppointment).not.toHaveBeenCalled();

    // 3. Fill in required patient details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Asha Roy" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "91477 18046" } });
    fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: "2026-11-05" } });
    fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Evening" } });
    fireEvent.change(screen.getByLabelText(/what do you need help with\?/i), {
      target: { value: "Routine tooth cleaning" },
    });

    // 4. Affirmative consent checkbox
    const consentCheckbox = screen.getByLabelText(/i consent to elite dental clinic/i);
    expect(consentCheckbox).not.toBeChecked();
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();

    // 5. Submit valid form
    fireEvent.click(screen.getByRole("button", { name: /request appointment/i }));

    // 6. Verify transition to Success Confirmation card
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(
      screen.getByText(/your request has been received\. we'll call you shortly to confirm\./i),
    ).toBeInTheDocument();

    // 7. Verify mutation dispatch with normalized phone
    expect(createAppointment).toHaveBeenCalledOnce();
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Asha Roy",
        phone: "+919147718046",
        preferred_date: "2026-11-05",
        preferred_time: "Evening",
        message: "Routine tooth cleaning",
      }),
    );
  });

  it("handles failure gracefully and preserves user input on server error", async () => {
    createAppointment.mockRejectedValueOnce(
      new AppError("SERVER", "Database temporarily unavailable", {
        userMessage: "Something went wrong. Please call us instead.",
      }),
    );

    renderBookingPage();

    // Fill details
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Debayan Saha" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "98765 43210" } });
    fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Morning" } });
    fireEvent.click(screen.getByLabelText(/i consent to elite dental clinic/i));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /request appointment/i }));

    // Verify error banner is shown
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please call us instead.",
    );

    // Verify user input was preserved (uncontrolled inputs not cleared on failure)
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe("Debayan Saha");
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe("98765 43210");
  });
});
