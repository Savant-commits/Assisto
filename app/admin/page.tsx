import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminSendWarning from "@/components/admin-send-warning";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-semibold">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/reports"
          className="rounded-lg border p-6 hover:bg-muted"
        >
          <h2 className="font-semibold">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage reports</p>
        </Link>

        <Link
          href="/admin/enquiries"
          className="rounded-lg border p-6 hover:bg-muted"
        >
          <h2 className="font-semibold">Enquiries</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage service enquiries</p>
        </Link>

        <Link
          href="/admin/applications"
          className="rounded-lg border p-6 hover:bg-muted"
        >
          <h2 className="font-semibold">Applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review provider applications</p>
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Actions</h2>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Send Warning</h3>
          <p className="mt-1 text-sm text-muted-foreground">Send a warning to any user</p>
          <AdminSendWarning />
        </div>
      </div>
    </div>
  );
}
