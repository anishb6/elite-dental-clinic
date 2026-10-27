/**
 * Turnstile behaviour of the booking form.
 *
 * Tokens are single-use, so the form must (1) not submit before the widget has produced one and
 * (2) reset the widget after every submit, otherwise a retry after a failed request re-sends a
 * spent token and the server rejects it as a bot.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/config/env.public", () => ({
  publicEnv: { turnstileSiteKey: "test-site-key", siteUrl: "https://example.com", gaId: undefined },
}));

const createAppointment = vi.fn();
vi.mock("../api/appointments.api", () => ({
  createAppointment: (p: unknown) => createAppointment(p),
}));

import { BookingForm } from "./booking-form";

type RenderOptions = { callback: (token: string) => void };
let issueToken: (token: string) => void;
const widgetRender = vi.fn((_el: unknown, options: RenderOptions) => {
  issueToken = options.callback;
  return "widget-1";
});
const widgetReset = vi.fn();
const widgetRemove = vi.fn();

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookingForm />
    </QueryClientProvider>,
  );
}

const button = () => screen.getByRole("button", { name: /request appointment|verifying|sending/i });

function fillValid() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Asha Roy" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "91477 18046" } });
  fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: "2026-11-05" } });
  fireEvent.change(screen.getByLabelText(/preferred time/i), { target: { value: "Evening" } });
  fireEvent.click(screen.getByLabelText(/i consent to elite dental clinic/i));
}

beforeEach(() => {
  createAppointment.mockReset();
  widgetRender.mockClear();
  widgetReset.mockClear();
  widgetRemove.mockClear();
  (window as unknown as { turnstile: unknown }).turnstile = {
    render: widgetRender,
    reset: widgetReset,
    remove: widgetRemove,
  };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T20:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe("BookingForm + Cloudflare Turnstile", () => {
  it("keeps submit disabled until the widget issues a token", () => {
    renderForm();
    expect(button()).toBeDisabled();
    expect(button()).toHaveTextContent(/verifying/i);

    act(() => issueToken("token-1"));
    expect(button()).toBeEnabled();
    expect(button()).toHaveTextContent(/request appointment/i);
  });

  it("sends the token, then resets the widget so the spent token can't be reused", async () => {
    createAppointment.mockResolvedValue({ id: "x", saved: true });
    renderForm();
    act(() => issueToken("token-1"));
    fillValid();
    fireEvent.click(button());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(createAppointment.mock.calls[0]![0]).toMatchObject({ turnstile_token: "token-1" });
    expect(widgetReset).toHaveBeenCalledWith("widget-1");
  });

  it("after a failed request, blocks retry until a fresh token arrives, then sends the new one", async () => {
    createAppointment
      .mockRejectedValueOnce(new AppError("SERVER", "boom", { status: 500 }))
      .mockResolvedValueOnce({ id: "x", saved: true });
    renderForm();
    act(() => issueToken("token-1"));
    fillValid();
    fireEvent.click(button());
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));

    // Spent token cleared: the button is locked until Cloudflare issues another.
    await waitFor(() => expect(button()).toBeDisabled());
    act(() => issueToken("token-2"));
    await waitFor(() => expect(button()).toBeEnabled());

    fireEvent.click(button());
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(2));
    expect(createAppointment.mock.calls[1]![0]).toMatchObject({ turnstile_token: "token-2" });
  });

  it("removes the widget when the form unmounts", () => {
    const { unmount } = renderForm();
    unmount();
    expect(widgetRemove).toHaveBeenCalledWith("widget-1");
  });
});
