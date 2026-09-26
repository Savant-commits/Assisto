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
       profiles!reports_reporter_id_fkey(full_name,user_code)`
    )
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("reports query failed:", JSON.stringify(reportsError, null, 2));
  }

  const safeReports = reports || [];

  const providerIds = safeReports.filter(r => r.reportable_type === "provider").map(r => r.reportable_id);
  const reviewIds = safeReports.filter(r => r.reportable_type === "review").map(r => r.reportable_id);

  const [{ data: providers }, { data: reviews }] = await Promise.all([
    providerIds.length
      ? supabase.from("providers").select("id,business_name").in("id", providerIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
    reviewIds.length
      ? supabase
          .from("reviews")
          .select("id,rating,comment,provider_id,customer_id,profiles!reviews_customer_id_fkey(full_name)")
          .in("id", reviewIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const providerMap = new Map((providers || []).map(p => [p.id, p]));
  const reviewMap = new Map((reviews || []).map(r => [r.id, r]));

  const enrichedReports = safeReports.map(r => ({
    ...r,
    target:
      r.reportable_type === "provider"
        ? providerMap.get(r.reportable_id) ?? null
        : reviewMap.get(r.reportable_id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Reports (admin)</h1>
      <p className="mb-6 text-muted-foreground">{enrichedReports.length} reports</p>

      <AdminReportsTabs reports={enrichedReports} />
    </div>
  );
}