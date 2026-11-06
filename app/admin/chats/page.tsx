import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminChatsList from "@/components/admin-chats-list";
import type { AdminChatSummary } from "@/components/admin-chats-list";
import { humanDuration } from "@/lib/chat-duration";
import { one } from "@/lib/relations";

type Relation<T> = T | T[] | null;
type ReportRow = { reportable_id: string; status: string; created_at: string };
type ProjectMessageRow = { id: string; project_id: string };
type EnquiryProfile = { full_name: string | null; user_code: string | null };
type EnquiryProvider = {
  id: string;
  business_name: string | null;
  profiles?: Relation<{ user_code: string | null }>;
};
type EnquiryRow = {
  enquiry_code: string | null;
  status: string | null;
  completed_at: string | null;
  admin_cancelled_at: string | null;
  updated_at: string | null;
  profiles?: Relation<EnquiryProfile>;
  providers?: Relation<EnquiryProvider>;
};
type ProjectRow = {
  id: string;
  project_code: string;
  created_at: string;
  enquiries?: Relation<EnquiryRow>;
};

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

  const reportRows = (reports ?? []) as ReportRow[];
  const reportIds = reportRows.map((report) => report.reportable_id);

  const { data: projectMessages, error: pmError } = reportIds.length
    ? await supabase.from("project_messages").select("id,project_id").in("id", reportIds)
    : { data: [] as ProjectMessageRow[], error: null };

  if (pmError) {
    console.error("project_messages query failed:", {
      message: pmError.message,
      details: pmError.details,
      hint: pmError.hint,
      code: pmError.code,
    });
  }

  const messageRows = (projectMessages ?? []) as ProjectMessageRow[];
  const projectIds = Array.from(new Set(messageRows.map((message) => message.project_id)));

  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase
        .from("projects")
        .select(
          `id,project_code,created_at,enquiries(id,enquiry_code,status,completed_at,admin_cancelled_at,updated_at,customer_id,provider_id,profiles!enquiries_customer_id_fkey(full_name,user_code),providers(id,business_name,profiles!providers_id_fkey(user_code)))`
        )
        .in("id", projectIds)
      : { data: [] as ProjectRow[], error: null };

  if (projectsError) {
    console.error("projects query failed:", {
      message: projectsError.message,
      details: projectsError.details,
      hint: projectsError.hint,
      code: projectsError.code,
    });
  }

  const byProject: AdminChatSummary[] = ((projects ?? []) as ProjectRow[]).map((project) => {
    const projectReports = reportRows.filter((report) => {
      const msg = messageRows.find((message) => message.id === report.reportable_id);
      return msg?.project_id === project.id;
    });

    const totalReports = projectReports.length;
    const unresolvedReports = projectReports.filter((report) => report.status === "open" || report.status === "reviewed").length;
    const latestReport = projectReports.reduce<ReportRow | undefined>((acc, cur) => (acc && acc.created_at > cur.created_at ? acc : cur), undefined);
    const oldestUnresolved = projectReports
      .filter((report) => report.status === "open" || report.status === "reviewed")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const jumpMessageId = (oldestUnresolved ?? latestReport)?.reportable_id ?? null;

    const enquiry = one(project.enquiries);
    const openedAt = project.created_at;
    // closedAt: for any non-confirmed enquiry use completed/admin_cancelled/updated, otherwise leave null so duration is "Open for"
    const closedAt = enquiry?.status !== "confirmed" ? enquiry?.completed_at ?? enquiry?.admin_cancelled_at ?? enquiry?.updated_at ?? null : null;

    const customer = one(enquiry?.profiles);
    const provider = one(enquiry?.providers);
    const providerProfile = one(provider?.profiles);

    return {
      id: project.id,
      project_code: project.project_code,
      enquiry_code: enquiry?.enquiry_code ?? null,
      enquiry_status: enquiry?.status ?? null,
      customer,
      provider: provider ? { ...provider, profiles: providerProfile } : null,
      openedAt,
      duration: humanDuration(openedAt, closedAt),
      totalReports,
      unresolvedReports,
      latestReportTime: latestReport?.created_at ?? null,
      jumpMessageId,
    };
  });

  // Sorting: unresolved first (newest latestReportTime), then resolved by latestReportTime desc
  byProject.sort((a, b) => {
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
