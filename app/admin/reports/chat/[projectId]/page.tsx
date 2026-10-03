import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminChatViewer from "@/components/admin-chat-viewer";
import { formatDateTime, humanDuration } from "@/lib/chat-duration";

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
    .single();

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
    .select("id,body,sender_id,created_at,deleted_at")
    .eq("project_id", resolvedParams.projectId)
    .order("created_at", { ascending: true });

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

  const messageIds = messages.map((m: any) => m.id);

  const { data: attachments, error: attachmentsError } = await supabase
    .from("project_message_attachments")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

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

  const attachmentsByMessage = new Map<string, any[]>();
  for (const att of attachments || []) {
    const signed = signedUrlByBucketAndPath.get(`${att.bucket}:${att.storage_path}`) ?? null;
    const row = { ...att, signedUrl: signed };
    const arr = attachmentsByMessage.get(att.message_id) ?? [];
    attachmentsByMessage.set(att.message_id, [...arr, row]);
  }

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id,reportable_id,status,reason,reporter_id,created_at,profiles!reports_reporter_id_fkey(full_name)")
    .in("reportable_id", messageIds)
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

  const reportedMessageIds = (reports || []).map((r: any) => r.reportable_id);

  // choose target message
  const requested = resolvedSearch?.message;
  const targetFromParams = requested && reportedMessageIds.includes(requested) ? requested : null;
  const oldestUnresolved = (reports || []).filter((r: any) => r.status === "open").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const fallback = oldestUnresolved?.reportable_id ?? reportedMessageIds[reportedMessageIds.length - 1] ?? messages[0].id;
  const targetMessageId = targetFromParams ?? fallback;

  const enrichedMessages = (messages || []).map((m: any) => ({
    ...m,
    attachments: attachmentsByMessage.get(m.id) ?? [],
    reports: (reports || []).filter((r: any) => r.reportable_id === m.id),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminChatViewer
        project={{ id: project.id, project_code: project.project_code, openedAt: project.created_at }}
        enquiry={Array.isArray(project.enquiries) ? project.enquiries[0] : project.enquiries}
        customer={Array.isArray(project.enquiries) ? (project.enquiries[0]?.profiles ?? null) : (project.enquiries?.profiles ?? null)}
        provider={Array.isArray(project.enquiries) ? (Array.isArray(project.enquiries[0]?.providers) ? project.enquiries[0]?.providers[0] ?? null : project.enquiries[0]?.providers ?? null) : (project.enquiries?.providers ?? null)}
        messages={enrichedMessages}
        targetMessageId={targetMessageId}
      />
    </div>
  );
}
