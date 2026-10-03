import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminChatViewer from "@/components/admin-chat-viewer";
import { humanDuration } from "@/lib/chat-duration";

type ProjectMessageRecord = {
  id: string;
  body: string | null;
  sender_id: string;
  created_at: string;
  deleted_at?: string | null;
  admin_removed_at?: string | null;
  profiles?: { full_name?: string | null; user_code?: string | null; role?: string | null } | null;
  signedUrl?: string | null;
  [key: string]: unknown;
};

type ReportRecord = {
  id: string;
  reportable_id: string;
  status: string;
  reason?: string | null;
  reporter_id?: string | null;
  created_at: string;
  admin_notes?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type ProjectProvider = {
  id?: string | null;
  business_name?: string | null;
  profiles?: { user_code?: string | null } | null;
};

type ProjectEnquiry = {
  id?: string | null;
  enquiry_code?: string | null;
  status?: string | null;
  completed_at?: string | null;
  admin_cancelled_at?: string | null;
  updated_at?: string | null;
  customer_id?: string | null;
  provider_id?: string | null;
  profiles?: { full_name?: string | null; user_code?: string | null } | null;
  providers?: ProjectProvider | ProjectProvider[] | null;
};

type ProjectRecord = {
  id: string;
  project_code: string | null;
  created_at: string;
  enquiries?: ProjectEnquiry | ProjectEnquiry[] | null;
};

export default async function AdminReportChatPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ message?: string }> }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect(`/login?redirect=/admin/reports/chat/${resolvedParams.projectId}`);

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,project_code,created_at,enquiries(id,enquiry_code,status,completed_at,admin_cancelled_at,updated_at,customer_id,provider_id,profiles!enquiries_customer_id_fkey(full_name,user_code),providers(id,business_name,profiles!providers_id_fkey(user_code)))")
    .eq("id", resolvedParams.projectId)
    .single<ProjectRecord>();

  if (projectError) {
    console.error("project query failed:", {
      message: projectError.message,
      details: projectError.details,
      hint: projectError.hint,
      code: projectError.code,
    });
  }

  if (!project) notFound();

  // load messages
  const { data: messages, error: messagesError } = await supabase
    .from("project_messages")
    .select("id,body,sender_id,created_at,deleted_at,admin_removed_at,profiles!project_messages_sender_id_fkey(full_name,user_code,role)")
    .eq("project_id", resolvedParams.projectId)
    .order("created_at", { ascending: true });

  const typedMessages: ProjectMessageRecord[] = (messages ?? []) as ProjectMessageRecord[];

  if (messagesError) {
    console.error("project_messages query failed:", {
      message: messagesError.message,
      details: messagesError.details,
      hint: messagesError.hint,
      code: messagesError.code,
    });
  }

  if (!messages || messages.length === 0) {
    // chat not reported or RLS blocked — show short notice
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Reported Chat</h1>
        <p className="text-muted-foreground">This chat has no reported messages, so its content is not available.</p>
        <p className="mt-4"><a href="/admin/chats" className="text-blue-600 underline">Back to Chats</a></p>
      </div>
    );
  }

  const messageIds = typedMessages.map((m) => m.id);

  const { data: attachments, error: attachmentsError } = await supabase
    .from("project_message_attachments")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  const typedAttachments = (attachments ?? []) as ProjectAttachmentRecord[];

  if (attachmentsError) {
    console.error("attachments query failed:", {
      message: attachmentsError.message,
      details: attachmentsError.details,
      hint: attachmentsError.hint,
      code: attachmentsError.code,
    });
  }

  // signed urls per bucket
  const bucketPathsByBucket: Record<string, string[]> = {};
  for (const att of attachments || []) {
    if (att.bucket && att.storage_path) {
      bucketPathsByBucket[att.bucket] = bucketPathsByBucket[att.bucket] || [];
      bucketPathsByBucket[att.bucket].push(att.storage_path);
    }
  }

  const signedUrlByBucketAndPath = new Map<string, string | null>();
  await Promise.all(
    Object.entries(bucketPathsByBucket).map(async ([bucket, paths]) => {
      if (!bucket || !paths.length) return;
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
        if (error || !data) {
          for (const p of paths) signedUrlByBucketAndPath.set(`${bucket}:${p}`, null);
          return;
        }
        for (const [i, p] of paths.entries()) signedUrlByBucketAndPath.set(`${bucket}:${p}`, data[i]?.signedUrl ?? null);
      } catch {
        for (const p of paths) signedUrlByBucketAndPath.set(`${bucket}:${p}`, null);
      }
    })
  );

  const attachmentsByMessage = new Map<string, ProjectAttachmentRecord[]>();
  for (const att of typedAttachments) {
    const signed = signedUrlByBucketAndPath.get(`${att.bucket}:${att.storage_path}`) ?? null;
    const row = { ...att, signedUrl: signed };
    const arr = attachmentsByMessage.get(att.message_id) ?? [];
    attachmentsByMessage.set(att.message_id, [...arr, row]);
  }

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id,reportable_id,status,reason,reporter_id,created_at,admin_notes,profiles!reports_reporter_id_fkey(full_name)")
    .in("reportable_id", messageIds)
    .eq("reportable_type", "project_message")
    .order("created_at", { ascending: false });

  const typedReports = (reports ?? []) as ReportRecord[];

  if (reportsError) {
    console.error("reports query failed:", {
      message: reportsError.message,
      details: reportsError.details,
      hint: reportsError.hint,
      code: reportsError.code,
    });
  }

  const reportRows = typedReports.map((r) => {
    const message = typedMessages.find((m) => m.id === r.reportable_id);
    return {
      id: r.id,
      reportable_id: r.reportable_id,
      status: r.status,
      reason: r.reason,
      reporter_name: r.profiles?.full_name ?? null,
      admin_notes: r.admin_notes ?? null,
      target: {
        sender_id: message?.sender_id ?? null,
        full_name: message?.profiles?.full_name ?? null,
        user_code: message?.profiles?.user_code ?? null,
        admin_removed_at: message?.admin_removed_at ?? null,
        role: message?.profiles?.role ?? null,
      },
    };
  });

  const reportedMessageIds = reportRows.map((r) => r.reportable_id);

  // choose target message
  const requested = resolvedSearch?.message;
  const targetFromParams = requested && reportedMessageIds.includes(requested) ? requested : null;
  const oldestUnresolved = typedReports.filter((r) => r.status === "open").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const fallback = oldestUnresolved?.reportable_id ?? reportedMessageIds[reportedMessageIds.length - 1] ?? messages[0].id;
  const targetMessageId = targetFromParams ?? fallback;

  const enrichedMessages = typedMessages.map((m) => ({
    ...m,
    attachments: attachmentsByMessage.get(m.id) ?? [],
    reports: reportRows.filter((r) => r.reportable_id === m.id),
  }));

  const enquiry = Array.isArray(project.enquiries) ? project.enquiries[0] : project.enquiries;
  const closedAt = enquiry?.status !== "confirmed" ? enquiry?.completed_at ?? enquiry?.admin_cancelled_at ?? enquiry?.updated_at ?? null : null;
  const durationLabel = enquiry?.status === "confirmed" ? `Open for ${humanDuration(project.created_at, null)}` : `Was open for ${humanDuration(project.created_at, closedAt)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminChatViewer
        project={{ id: project.id, project_code: project.project_code, openedAt: project.created_at }}
        enquiry={enquiry}
        customer={Array.isArray(project.enquiries) ? (project.enquiries[0]?.profiles ?? null) : (project.enquiries?.profiles ?? null)}
        provider={Array.isArray(project.enquiries) ? (Array.isArray(project.enquiries[0]?.providers) ? project.enquiries[0]?.providers[0] ?? null : project.enquiries[0]?.providers ?? null) : (project.enquiries?.providers ?? null)}
        messages={enrichedMessages}
        reports={reportRows}
        targetMessageId={targetMessageId}
        durationLabel={durationLabel}
      />
    </div>
  );
}
