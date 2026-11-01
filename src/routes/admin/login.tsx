import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginForm } from "@/features/admin/components/admin-login-form";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Staff Login | Elite Dental Clinic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginForm,
});
