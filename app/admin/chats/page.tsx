import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminChatsList from "@/components/admin-chats-list";
import { humanDuration, formatDateTime } from "@/lib/chat-duration";

export default async function AdminChatsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/chats");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id,reportable_id,status,reason,created_at")
    .eq("reportable_type", "project_message")
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("reports query failed:", {
      message: reportsError.message,
      details: reportsError.details,
      hint: reportsError.hint,
      code: reportsError.code,
    });
  }

  const reportIds = (reports || []).map((r: any) => r.reportable_id);

  const { data: projectMessages, error: pmError } = reportIds.length
    ? await supabase.from("project_messages").select("id,project_id").in("id", reportIds)
    : { data: [] };

  if (pmError) {
    console.error("project_messages query failed:", {
      message: pmError.message,
      details: pmError.details,
      hint: pmError.hint,
      code: pmError.code,
    });
  }

  const projectIds = Array.from(new Set((projectMessages || []).map((m: any) => m.project_id)));

  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase
        .from("projects")
        .select(
          `id,project_code,created_at,enquiries(id,enquiry_code,status,completed_at,admin_cancelled_at,updated_at,customer_id,provider_id,profiles!enquiries_customer_id_fkey(full_name,user_code),providers(id,business_name,profiles!providers_id_fkey(user_code)))`
        )
        .in("id", projectIds)
    : { data: [] };

  if (projectsError) {
    console.error("projects query failed:", {
      message: projectsError.message,
      details: projectsError.details,
      hint: projectsError.hint,
      code: projectsError.code,
    });
  }

  const byProject = (projects || []).map((p: any) => {
    const projectReports = (reports || []).filter((r: any) => {
      const msg = (projectMessages || []).find((m: any) => m.id === r.reportable_id);
      return msg?.project_id === p.id;
    });

    const totalReports = projectReports.length;
    const unresolvedReports = projectReports.filter((r: any) => r.status === "open").length;
    const latestReport = projectReports.reduce((acc: any, cur: any) => (acc && acc.created_at > cur.created_at ? acc : cur), projectReports[0]);
    const oldestUnresolved = projectReports.filter((r: any) => r.status === "open").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const jumpMessageId = (oldestUnresolved || latestReport)?.reportable_id ?? null;

    const enquiry = Array.isArray(p.enquiries) ? p.enquiries[0] : p.enquiries ?? null;
    const openedAt = p.created_at;
    // closedAt: for any non-confirmed enquiry use completed/admin_cancelled/updated, otherwise leave null so duration is "Open for"
    const closedAt = enquiry?.status !== "confirmed" ? enquiry?.completed_at ?? enquiry?.admin_cancelled_at ?? enquiry?.updated_at ?? null : null;

    const customer = enquiry?.profiles ?? null;
    const provider = Array.isArray(enquiry?.providers) ? enquiry?.providers[0] ?? null : enquiry?.providers ?? null;

    return {
      id: p.id,
      project_code: p.project_code,
      enquiry_code: enquiry?.enquiry_code ?? null,
      enquiry_status: enquiry?.status ?? null,
      customer,
      provider,
      openedAt,
      duration: humanDuration(openedAt, closedAt),
      totalReports,
      unresolvedReports,
      latestReportTime: latestReport?.created_at ?? null,
      jumpMessageId,
    };
  });

  // Sorting: unresolved first (newest latestReportTime), then resolved by latestReportTime desc
  byProject.sort((a: any, b: any) => {
    if ((a.unresolvedReports > 0) !== (b.unresolvedReports > 0)) return a.unresolvedReports > 0 ? -1 : 1;
    return (b.latestReportTime || "") > (a.latestReportTime || "") ? 1 : -1;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Reported Chats (admin)</h1>
      <p className="mb-6 text-muted-foreground">Only chats with at least one reported message appear here.</p>

      <AdminChatsList chats={byProject} />
    </div>
  );
}
