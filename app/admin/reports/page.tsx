import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminReportsTabs from "@/components/admin-reports-tabs";

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/reports");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select(
      `id,reportable_type,reportable_id,reporter_id,reason,status,admin_notes,created_at,updated_at,
       profiles!reports_reporter_id_fkey(full_name,user_code),
       providers(id,business_name),
       reviews(id,rating,comment,provider_id,profiles!reviews_customer_id_fkey(full_name))`
    )
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("reports query failed:", {
      message: reportsError.message,
      details: reportsError.details,
      hint: reportsError.hint,
      code: reportsError.code,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Reports (admin)</h1>
      <p className="mb-6 text-muted-foreground">{reports?.length ?? 0} reports</p>

      <AdminReportsTabs reports={reports || []} />
    </div>
  );
}
