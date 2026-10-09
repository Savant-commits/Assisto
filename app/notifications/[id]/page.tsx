import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTimeTaken(startStr: string | null, endStr: string | null): string | null {
  if (!startStr || !endStr) return null;
  
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const diffMs = end - start;
  
  if (diffMs < 0) return null;
  
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 48) {
    if (mins === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  if (hrs === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''} ${hrs} hour${hrs !== 1 ? 's' : ''}`;
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  enquiry_id: number;
  customer_id: string;
  profiles?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

type Enquiry = {
  created_at: string;
  is_asap: boolean | null;
  scheduled_start_at: string | null;
  contact_unlocked_at: string | null;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  customer_requirements?: { description: string | null } | Array<{ description: string | null }> | null;
  projects?: { id: string; project_code: string } | Array<{ id: string; project_code: string }> | null;
};

export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("notification auth lookup failed:", userError.message, undefined, undefined, userError.code);
  }
  if (!userData.user) return notFound();

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("id,title,body,is_read,type,related_id,created_at,recipient_id")
    .eq("id", id)
    .maybeSingle();

  if (notificationError) {
    console.error("notification lookup failed:", notificationError.message, notificationError.details, notificationError.hint, notificationError.code);
  }

  if (!notification || notification.recipient_id !== userData.user.id) return notFound();

  if (!notification.is_read) {
    const { error: updateError } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (updateError) {
      console.error("notification read update failed:", updateError.message, updateError.details, updateError.hint, updateError.code);
    }
  }

  if (notification.type === "credential_submitted" && notification.related_id) {
    redirect(`/admin/credentials?credential=${encodeURIComponent(notification.related_id)}`);
  }

  if (notification.type === "credential_reviewed") {
    redirect("/provider/credentials");
  }

  if (notification.type === "project_message" && notification.related_id) {
    redirect(`/enquiries?chat=${notification.related_id}`);
  }

  if (notification.type === "new_report" && notification.related_id) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("notification admin role lookup failed:", profileError.message, profileError.details, profileError.hint, profileError.code);
    }

    if (profile?.role === "admin") {
      const { data: report, error: reportError } = await supabase
        .from("reports")
        .select("id,reportable_type,reportable_id,status")
        .eq("id", notification.related_id)
        .maybeSingle();

      if (reportError) {
        console.error("notification report lookup failed:", reportError.message, reportError.details, reportError.hint, reportError.code);
      }

      if (report?.reportable_type === "project_message" && report.reportable_id) {
        const { data: message, error: messageError } = await supabase
          .from("project_messages")
          .select("project_id")
          .eq("id", report.reportable_id)
          .maybeSingle();

        if (messageError) {
          console.error("notification project message lookup failed:", messageError.message, messageError.details, messageError.hint, messageError.code);
        }

        if (message?.project_id) {
          redirect(`/admin/reports/chat/${message.project_id}?message=${report.reportable_id}`);
        }
      }

      redirect("/admin/reports");
    }
  }

  // Handle review_received type
  let review: Review | null = null;
  let enquiry: Enquiry | null = null;

  if (notification.type === "review_received" && notification.related_id) {
    // Try to find review by id first
    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at,enquiry_id,customer_id,profiles!reviews_customer_id_fkey(full_name)")
      .eq("id", notification.related_id)
      .maybeSingle();

    if (reviewError) {
      console.error("Review lookup error:", reviewError.message, reviewError.details, reviewError.hint, reviewError.code);
    }

    if (reviewData) {
      review = reviewData as unknown as Review;
    } else {
      // Try to find review by enquiry_id
      const { data: reviewByEnquiry, error: reviewByEnquiryError } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,enquiry_id,customer_id,profiles!reviews_customer_id_fkey(full_name)")
        .eq("enquiry_id", notification.related_id)
        .maybeSingle();

      if (reviewByEnquiryError) {
        console.error("Review lookup by enquiry error:", reviewByEnquiryError.message, reviewByEnquiryError.details, reviewByEnquiryError.hint, reviewByEnquiryError.code);
      }

      if (reviewByEnquiry) {
        review = reviewByEnquiry as unknown as Review;
      }
    }

    // Load enquiry if review found
    if (review) {
      const { data: enquiryData, error: enquiryError } = await supabase
        .from("enquiries")
        .select("created_at,is_asap,scheduled_start_at,contact_unlocked_at,customer_completed_at,provider_completed_at,customer_requirements(description),projects(id,project_code)")
        .eq("id", review.enquiry_id)
        .maybeSingle();

      if (enquiryError) {
        console.error("Enquiry lookup error:", enquiryError.message, enquiryError.details, enquiryError.hint, enquiryError.code);
      }

      if (enquiryData) {
        enquiry = enquiryData as unknown as Enquiry;
      }
    }
  }

  const reviewProfile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
  const customerRequirements = Array.isArray(enquiry?.customer_requirements)
    ? enquiry.customer_requirements[0]
    : enquiry?.customer_requirements;
  const project = Array.isArray(enquiry?.projects) ? enquiry.projects[0] : enquiry?.projects;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{notification.title}</h1>
        <div className="text-sm text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</div>
      </div>

      {notification.type === "review_received" && review && enquiry ? (
        <div className="rounded-lg border p-6 space-y-4">
          {/* Rating and comment */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg text-yellow-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              <span className="text-sm font-medium">{review.rating}/5</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {review.comment || "No comment left"}
            </div>
          </div>

          {/* Customer name and review date */}
          {reviewProfile?.full_name && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">From</h2>
              <p className="mt-1">{reviewProfile.full_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Reviewed {formatDateTime(review.created_at)}</p>
            </div>
          )}

          {/* Type of work */}
          {customerRequirements?.description && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Type of work</h2>
              <p className="mt-1">{customerRequirements.description}</p>
            </div>
          )}

          {/* Enquiry received */}
          {enquiry.created_at && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Enquiry received</h2>
              <p className="mt-1 text-sm">{formatDateTime(enquiry.created_at)}</p>
            </div>
          )}

          {/* Work started */}
          {(enquiry.scheduled_start_at || enquiry.contact_unlocked_at) && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">
                Work started
              </h2>
              <p className="mt-1 text-sm">
                {enquiry.scheduled_start_at
                  ? `${formatDateTime(enquiry.scheduled_start_at)}${enquiry.is_asap ? ' (Confirmed)' : ''}`
                  : enquiry.contact_unlocked_at
                  ? `${formatDateTime(enquiry.contact_unlocked_at)} (Confirmed)`
                  : ''}
              </p>
            </div>
          )}

          {/* Work completed */}
          {(enquiry.customer_completed_at || enquiry.provider_completed_at) && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Work completed</h2>
              <p className="mt-1 text-sm">
                {formatDateTime(
                  enquiry.customer_completed_at && enquiry.provider_completed_at
                    ? new Date(enquiry.customer_completed_at).getTime() > new Date(enquiry.provider_completed_at).getTime()
                      ? enquiry.customer_completed_at
                      : enquiry.provider_completed_at
                    : enquiry.customer_completed_at || enquiry.provider_completed_at
                )}
              </p>
            </div>
          )}

          {/* Time taken */}
          {(() => {
            const workStart = enquiry.scheduled_start_at || enquiry.contact_unlocked_at;
            const workEnd = enquiry.customer_completed_at && enquiry.provider_completed_at
              ? new Date(enquiry.customer_completed_at).getTime() > new Date(enquiry.provider_completed_at).getTime()
                ? enquiry.customer_completed_at
                : enquiry.provider_completed_at
              : enquiry.customer_completed_at || enquiry.provider_completed_at;
            const timeTaken = formatTimeTaken(workStart, workEnd);
            return timeTaken ? (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground">Time taken</h2>
                <p className="mt-1 text-sm">{timeTaken}</p>
              </div>
            ) : null;
          })()}

          {/* Project code */}
          {project?.id && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground">Project</h2>
              <a href={`/projects/${project.id}`} className="mt-1 text-sm text-blue-600 underline">
                {project.project_code}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="prose max-w-full">{notification.body}</div>
      )}
    </main>
  );
}
