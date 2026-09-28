import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContactUnlock } from "@/components/contact-unlock";
import { CompletionActions } from "@/components/completion-actions";

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusBadge(status: string) {
  const cls =
    status === "accepted" || status === "confirmed"
      ? "bg-green-100 text-green-800"
      : status === "declined" || status === "cancelled"
      ? "bg-red-100 text-red-800"
      : status === "completed"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{status}</span>;
}

type ProjectDetail = {
  id: string;
  project_code: string;
  enquiry_id: string;
  enquiries: {
    id: string;
    enquiry_code: string;
    status: string;
    scheduled_start_at: string | null;
    is_asap: boolean | null;
    contact_unlocked_at: string | null;
    customer_id: string;
    provider_id: string;
    customer_completed_at: string | null;
    provider_completed_at: string | null;
    profiles: {
      full_name: string | null;
    } | null;
    providers: {
      id: string;
      business_name: string | null;
    } | null;
  } | null;
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?redirect=/projects/${id}`);
  }

  // Fetch project with enquiry and related data
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      `id,project_code,enquiry_id,enquiries(id,enquiry_code,status,scheduled_start_at,is_asap,contact_unlocked_at,customer_id,provider_id,customer_completed_at,provider_completed_at,profiles!enquiries_customer_id_fkey(full_name),providers(id,business_name))`
    )
    .eq("id", id)
    .single();

  if (projectError || !project) {
    redirect("/");
  }

  const enquiry = project.enquiries;
  if (!enquiry) {
    redirect("/");
  }

  // Check admin status
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  const isAdmin = profile?.role === "admin";

  // Access control: must be customer, provider, or admin
  const isCustomer = enquiry.customer_id === userData.user.id;
  const isProvider = enquiry.provider_id === userData.user.id;

  if (!isAdmin && !isCustomer && !isProvider) {
    redirect("/");
  }

  function scheduleLine(enq: { is_asap?: boolean | null; scheduled_start_at?: string | null }) {
    if (enq.is_asap) return "Scheduled: Now (ASAP)";
    if (enq.scheduled_start_at) return `Scheduled: ${formatDateTime(enq.scheduled_start_at)}`;
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Link href="/enquiries" className="text-sm text-blue-600 underline">
          ← Back to enquiries
        </Link>
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{project.project_code}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enquiry: {enquiry.enquiry_code}</p>
          </div>
          <div>{statusBadge(enquiry.status)}</div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Customer</h2>
            <p className="mt-1">{enquiry.profiles?.full_name || "Unknown"}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Provider</h2>
            <Link href={`/providers/${enquiry.providers?.id ?? ""}`} className="mt-1 text-blue-600 underline">
              {enquiry.providers?.business_name || "Unknown"}
            </Link>
          </div>

          {scheduleLine(enquiry) && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Schedule</h2>
              <p className="mt-1 text-sm">{scheduleLine(enquiry)}</p>
            </div>
          )}

          {enquiry.contact_unlocked_at && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Contact Info</h2>
              <p className="mt-1 text-xs text-muted-foreground">Unlocked {formatDateTime(enquiry.contact_unlocked_at)}</p>
            </div>
          )}

          {enquiry.status === "confirmed" && isProvider && (
            <div className="mt-6 space-y-4 border-t pt-6">
              <ContactUnlock profileId={enquiry.customer_id} />
              <CompletionActions
                enquiryId={enquiry.id}
                role="provider"
                customerCompletedAt={enquiry.customer_completed_at}
                providerCompletedAt={enquiry.provider_completed_at}
                onUpdated={() => {
                  // In a real app, would refetch or update state
                  // For now, just a placeholder since this is a server component
                }}
              />
            </div>
          )}

          {enquiry.status === "confirmed" && isCustomer && (
            <div className="mt-6 border-t pt-6">
              <CompletionActions
                enquiryId={enquiry.id}
                role="customer"
                customerCompletedAt={enquiry.customer_completed_at}
                providerCompletedAt={enquiry.provider_completed_at}
                onUpdated={() => {
                  // In a real app, would refetch or update state
                  // For now, just a placeholder since this is a server component
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
