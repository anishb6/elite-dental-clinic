import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

// No network, database or e-mail: both data-access modules are replaced.
const createAppointment = vi.fn();
const notifyClinic = vi.fn();
vi.mock("../api/appointments.api", () => ({
  createAppointment: (p: unknown) => createAppointment(p),
}));
vi.mock("../api/notify-clinic.api", () => ({ notifyClinic: (p: unknown) => notifyClinic(p) }));

import { BookingForm } from "./booking-form";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookingForm />
    </QueryClientProvider>,
  );
}

const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp, value: string) =>
  fireEvent.change(input(label), { target: { value } });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /request appointment|sending/i }));

function fillValid() {
  type(/full name/i, "Asha Roy");
  type(/phone/i, "91477 18046");
  type(/preferred date/i, "2026-11-05");
  fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Evening" } });
  const consent = screen.getByLabelText(/i consent to elite dental clinic/i);
  if (!consent.hasAttribute("checked") && !(consent as HTMLInputElement).checked) {
    fireEvent.click(consent);
  }
}

beforeEach(() => {
  createAppointment.mockReset().mockResolvedValue(undefined);
  notifyClinic.mockReset().mockResolvedValue({ sent: true });
  // 27 Oct 2026 01:30 IST (still the 26th in UTC).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T20:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BookingForm", () => {
  it("sets the date picker's minimum to today in clinic time, not the UTC date", () => {
    renderForm();
    expect(input(/preferred date/i).min).toBe("2026-10-27");
  });

  it("marks required fields and wires labels, hints and errors for assistive tech", () => {
    renderForm();
    expect(input(/full name/i)).toHaveAttribute("aria-required", "true");
    expect(input(/email/i)).not.toHaveAttribute("aria-required");
    expect(input(/phone/i).getAttribute("aria-describedby")).toBeTruthy(); // hint

    submit();
    const phone = input(/phone/i);
    expect(phone).toHaveAttribute("aria-invalid", "true");
    const describedBy = phone.getAttribute("aria-describedby")!.split(" ");
    const text = describedBy.map((id) => document.getElementById(id)?.textContent).join(" ");
    expect(text).toMatch(/10-digit Indian mobile/);
    expect(text).toMatch(/Please enter your phone number/);
  });

  it("shows inline errors for empty required fields, focuses the first, and sends nothing", () => {
    renderForm();
    submit();

    expect(screen.getByText("Please enter your name")).toBeInTheDocument();
    expect(screen.getByText("Please enter your phone number")).toBeInTheDocument();
    expect(screen.getByText("Choose a date")).toBeInTheDocument();
    expect(screen.getByText("Choose a time")).toBeInTheDocument();
    expect(input(/full name/i)).toHaveFocus();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("keeps everything the visitor typed when validation fails", () => {
    renderForm();
    type(/full name/i, "Asha Roy");
    type(/phone/i, "12345");
    type(/email/i, "asha@example.com");
    type(/preferred date/i, "2026-11-05");
    fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Morning" } });
    type(/what do you need help with/i, "Toothache");
    submit();

    expect(screen.getByText(/international number starting with \+/i)).toBeInTheDocument();
    expect(input(/phone/i)).toHaveFocus();
    expect(input(/full name/i).value).toBe("Asha Roy");
    expect(input(/phone/i).value).toBe("12345");
    expect(input(/email/i).value).toBe("asha@example.com");
    expect(input(/preferred date/i).value).toBe("2026-11-05");
    expect((screen.getByLabelText(/preferred time/i) as HTMLSelectElement).value).toBe("Morning");
    expect(input(/what do you need help with/i).value).toBe("Toothache");
  });

  it("rejects a past date inline but accepts today", () => {
    renderForm();
    fillValid();
    type(/preferred date/i, "2026-10-26");
    submit();
    expect(screen.getByText("Please choose today or a later date")).toBeInTheDocument();
    expect(createAppointment).not.toHaveBeenCalled();

    type(/preferred date/i, "2026-10-27"); // typing re-validates, so the error clears immediately
    expect(screen.queryByText("Please choose today or a later date")).not.toBeInTheDocument();
  });

  it("clears an error as soon as the field is corrected, without nagging about untouched fields", () => {
    renderForm();
    submit();
    expect(screen.getByText("Please enter your name")).toBeInTheDocument();

    type(/full name/i, "Asha");
    expect(screen.queryByText("Please enter your name")).not.toBeInTheDocument();
    expect(input(/full name/i)).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("Please enter your phone number")).toBeInTheDocument(); // untouched, still flagged from submit
  });

  it("does not flag an empty field merely because the visitor tabbed past it", () => {
    renderForm();
    fireEvent.blur(input(/full name/i));
    expect(screen.queryByText("Please enter your name")).not.toBeInTheDocument();
  });

  it("validates a field with content when the visitor leaves it", () => {
    renderForm();
    type(/phone/i, "abc");
    fireEvent.blur(input(/phone/i));
    expect(screen.getByText(/only contain digits/i)).toBeInTheDocument();
  });

  it("saves the normalised booking once and then shows success", async () => {
    renderForm();
    fillValid();
    submit();

    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(createAppointment).toHaveBeenCalledTimes(1);
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Asha Roy",
        phone: "+919147718046",
        email: null,
        preferred_date: "2026-11-05",
        preferred_time: "Evening",
        message: null,
        source: null,
        privacy_consent: true,
      }),
    );
  });

  it("prevents duplicate submissions while the request is in flight", async () => {
    let finish!: () => void;
    createAppointment.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderForm();
    fillValid();

    submit();
    const button = await screen.findByRole("button", { name: /sending/i });
    expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form")!); // e.g. Enter key
    submit();
    expect(createAppointment).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });

  it("shows an error - not success - when saving fails, and keeps the visitor's input", async () => {
    createAppointment.mockRejectedValue(
      new AppError("SERVER", "boom", {
        userMessage: "Something went wrong. Please call us instead.",
      }),
    );
    renderForm();
    fillValid();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please call us instead.",
    );
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
    expect(notifyClinic).not.toHaveBeenCalled();
    expect(input(/full name/i).value).toBe("Asha Roy");
    expect(input(/phone/i).value).toBe("91477 18046");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /request appointment/i })).toBeEnabled(),
    );
  });

  it("still reports success when only the clinic e-mail fails (the booking itself was saved)", async () => {
    createAppointment.mockResolvedValue({ id: "test-id", saved: true });
    renderForm();
    fillValid();
    submit();
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });

  it("never logs the visitor's phone number or details", async () => {
    const spies = (["error", "warn", "info", "log"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    createAppointment.mockRejectedValue(
      new AppError("SERVER", "insert failed", {
        cause: { details: "Failing row contains (+919147718046, Asha Roy)" },
      }),
    );
    renderForm();
    fillValid();
    submit();
    await screen.findByRole("alert");

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain("9147718046");
    expect(logged).not.toContain("Asha");
    spies.forEach((spy) => spy.mockRestore());
  });

  it("blocks submission and shows validation error if privacy consent is not checked", async () => {
    renderForm();
    type(/full name/i, "Asha Roy");
    type(/phone/i, "91477 18046");
    type(/preferred date/i, "2026-11-05");
    fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Evening" } });

    // Do NOT check the consent box
    submit();

    expect(
      await screen.findByText(/you must consent to the privacy policy to book an appointment/i),
    ).toBeInTheDocument();
    expect(createAppointment).not.toHaveBeenCalled();
  });
});
