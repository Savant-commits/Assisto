import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminSendWarning from "@/components/admin-send-warning";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("admin dashboard auth lookup failed:", userError.message, undefined, undefined, userError.code);
  }

  if (!userData.user) redirect("/login?redirect=/admin");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError) {
    console.error("admin dashboard role lookup failed:", profileError.message, profileError.details, profileError.hint, profileError.code);
  }
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

        <Link href="/admin/credentials" className="rounded-lg border p-6 hover:bg-muted">
          <h2 className="font-semibold">Credentials</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review provider certificates and licences</p>
        </Link>

        <Link href="/admin/bans" className="rounded-lg border p-6 hover:bg-muted">
          <h2 className="font-semibold">Bans</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review active and historical account suspensions</p>
        </Link>

        <Link href="/admin/chats" className="rounded-lg border p-6 hover:bg-muted">
          <h2 className="font-semibold">Chats</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review reported project conversations</p>
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
