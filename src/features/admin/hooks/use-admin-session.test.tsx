import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn();
const unsubscribe = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      signOut: () => signOut(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe } } }),
    },
  },
}));

import { useAdminSession } from "./use-admin-session";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useAdminSession", () => {
  it("exposes the token and email of an existing session", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok", user: { email: "staff@clinic.in" } } },
    });
    const { result } = renderHook(() => useAdminSession());
    await waitFor(() =>
      expect(result.current.session).toEqual({ token: "tok", email: "staff@clinic.in" }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects to login when reading the session fails instead of leaving an unhandled rejection", async () => {
    getSession.mockRejectedValue(new Error("storage unavailable"));
    renderHook(() => useAdminSession());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/login" }));
  });

  it("still leaves the portal when the sign-out request fails", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    signOut.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAdminSession());
    navigate.mockClear();
    await act(async () => {
      await result.current.signOut();
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/login" });
  });
});
