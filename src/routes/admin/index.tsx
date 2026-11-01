import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Staff Appointment Dashboard | Elite Dental Clinic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});
