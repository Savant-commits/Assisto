import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminReportsTabs from "@/components/admin-reports-tabs";
import type { ProjectMessageAttachment } from "@/lib/types";

type ProjectMessageTarget = {
  id: string;
  body: string;
  sender_id: string;
  project_id: string;
  created_at: string;
  deleted_at: string | null;
  profiles?: { full_name: string | null; user_code?: string | null } | null;
  project_code?: string | null;
  enquiry_code?: string | null;
  attachments?: Array<ProjectMessageAttachment & { signedUrl: string | null }> | null;
};

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
  const projectMessageIds = safeReports.filter(r => r.reportable_type === "project_message").map(r => r.reportable_id);

  const [{ data: providers }, { data: reviews }, { data: projectMessages }, { data: projectAttachments }] = await Promise.all([
    providerIds.length
      ? supabase.from("providers").select("id,business_name").in("id", providerIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
    reviewIds.length
      ? supabase
          .from("reviews")
          .select("id,rating,comment,provider_id,customer_id,profiles!reviews_customer_id_fkey(full_name,user_code)")
          .in("id", reviewIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            rating: number;
            comment: string | null;
            provider_id: string;
            customer_id: string;
            profiles?: { full_name: string | null; user_code?: string | null }[] | null;
          }[],
        }),
    projectMessageIds.length
      ? supabase
          .from("project_messages")
          .select(
            `id,body,sender_id,project_id,created_at,deleted_at,profiles!project_messages_sender_id_fkey(full_name,user_code),projects(id,project_code,enquiries(id,enquiry_code))`
          )
          .in("id", projectMessageIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            body: string;
            sender_id: string;
            project_id: string;
            created_at: string;
            deleted_at: string | null;
            profiles?: { full_name: string | null; user_code?: string | null }[] | null;
            projects?: Array<{
              project_code?: string | null;
              enquiries?: Array<{ enquiry_code?: string | null }> | null;
            }> | null;
          }[],
        }),
    projectMessageIds.length
      ? supabase
          .from("project_message_attachments")
          .select("*")
          .in("message_id", projectMessageIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as ProjectMessageAttachment[] }),
  ]);

  const attachmentMapByMessageId = new Map<string, Array<ProjectMessageAttachment & { signedUrl: string | null }>>();
  const bucketPathsByBucket: Record<string, string[]> = {};

  for (const attachment of projectAttachments || []) {
    const baseAttachment = { ...attachment, signedUrl: null } as ProjectMessageAttachment & { signedUrl: string | null };
    const existing = attachmentMapByMessageId.get(attachment.message_id) ?? [];
    attachmentMapByMessageId.set(attachment.message_id, [...existing, baseAttachment]);

    if (attachment.bucket && attachment.storage_path) {
      if (!bucketPathsByBucket[attachment.bucket]) {
        bucketPathsByBucket[attachment.bucket] = [];
      }
      bucketPathsByBucket[attachment.bucket].push(attachment.storage_path);
    }
  }

  const signedUrlByBucketAndPath = new Map<string, string | null>();

  await Promise.all(
    Object.entries(bucketPathsByBucket).map(async ([bucket, paths]) => {
      if (!bucket || !paths.length) return;

      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
        if (error || !data) {
          for (const path of paths) {
            signedUrlByBucketAndPath.set(`${bucket}:${path}`, null);
          }
          return;
        }

        for (const [index, path] of paths.entries()) {
          signedUrlByBucketAndPath.set(`${bucket}:${path}`, data[index]?.signedUrl ?? null);
        }
      } catch {
        for (const path of paths) {
          signedUrlByBucketAndPath.set(`${bucket}:${path}`, null);
        }
      }
    })
  );

  for (const [messageId, attachments] of attachmentMapByMessageId.entries()) {
    attachmentMapByMessageId.set(
      messageId,
      attachments.map((attachment) => ({
        ...attachment,
        signedUrl: signedUrlByBucketAndPath.get(`${attachment.bucket}:${attachment.storage_path}`) ?? null,
      }))
    );
  }

  const providerMap = new Map((providers || []).map(p => [p.id, p]));
  const reviewMap = new Map((reviews || []).map(r => [r.id, r]));
  const projectMessageMap = new Map(
    (projectMessages || []).map((message: ProjectMessageTarget & {
      projects?:
        | {
            project_code?: string | null;
            enquiries?:
              | { enquiry_code?: string | null }[]
              | { enquiry_code?: string | null }
              | null;
          }[]
        | {
            project_code?: string | null;
            enquiries?:
              | { enquiry_code?: string | null }[]
              | { enquiry_code?: string | null }
              | null;
          }
        | null;
      profiles?: { full_name: string | null; user_code?: string | null }[] | { full_name: string | null; user_code?: string | null } | null;
    }) => {
      const project = Array.isArray(message.projects) ? message.projects[0] : message.projects ?? null;
      const enquiry = Array.isArray(project?.enquiries) ? project.enquiries[0] : project?.enquiries ?? null;

      return [
        message.id,
        {
          ...message,
          profiles: Array.isArray(message.profiles) ? message.profiles[0] ?? null : message.profiles ?? null,
          project_code: project?.project_code ?? null,
          enquiry_code: enquiry?.enquiry_code ?? null,
          attachments: attachmentMapByMessageId.get(message.id) ?? [],
        },
      ];
    })
  );

  const enrichedReports = safeReports.map(r => ({
    ...r,
    target:
      r.reportable_type === "provider"
        ? providerMap.get(r.reportable_id) ?? null
        : r.reportable_type === "review"
          ? reviewMap.get(r.reportable_id) ?? null
          : projectMessageMap.get(r.reportable_id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Reports (admin)</h1>
      <p className="mb-6 text-muted-foreground">{enrichedReports.length} reports</p>

      <AdminReportsTabs reports={enrichedReports} />
    </div>
  );
}