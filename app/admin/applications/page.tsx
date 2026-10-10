import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationActions } from "@/components/application-actions";
import { ApplicationCallDialog } from "@/components/application-call-dialog";

const callStatusLabels = {
  pending: "Not called yet",
  verified: "Verified by call",
  not_verified: "Could not verify",
  unreachable: "Could not reach",
} as const;
const callStatusStyles = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  verified: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  not_verified: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unreachable: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
} as const;
type CallStatus = keyof typeof callStatusLabels;

export default async function AdminApplicationsPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("admin applications: failed to load session", {
      message: userError.message,
      details: "details" in userError ? userError.details : undefined,
      hint: "hint" in userError ? userError.hint : undefined,
      code: userError.code,
    });
  }

  if (!userData.user) redirect("/login?redirect=/admin/applications");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError) {
    console.error("admin applications: failed to load admin profile", {
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      code: profileError.code,
    });
  }

  // Page-level guard for UX (hide the page from non-admins). The real
  // security boundary is requireAdmin() inside the server actions —
  // this redirect alone is not what protects the writes.
  if (profile?.role !== "admin") redirect("/");

  const { data: applications, error: applicationsError } = await supabase
    .from("provider_applications")
    .select("id, user_id, professional_type, business_name, bio, city, years_experience, created_at, status, call_status, call_notes, called_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (applicationsError) {
    console.error("admin applications: failed to load applications", {
      message: applicationsError.message,
      details: applicationsError.details,
      hint: applicationsError.hint,
      code: applicationsError.code,
    });
  }

  const userIds = [...new Set((applications ?? []).map((app) => app.user_id))];
  const { data: applicantProfiles, error: applicantProfilesError } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, phone_verified_at").in("id", userIds)
    : { data: [], error: null };
  if (applicantProfilesError) {
    console.error("admin applications: failed to load applicant profiles", {
      message: applicantProfilesError.message,
      details: applicantProfilesError.details,
      hint: applicantProfilesError.hint,
      code: applicantProfilesError.code,
    });
  }
  const profilesById = new Map((applicantProfiles ?? []).map((applicant) => [applicant.id, applicant]));
  const applicationsWithPhones = await Promise.all((applications ?? []).map(async (app) => {
    const { data: phone, error: phoneError } = await supabase.rpc("admin_get_applicant_phone", {
      p_application_id: app.id,
    });
    if (phoneError) {
      console.error("admin applications: failed to load applicant phone", {
        message: phoneError.message,
        details: phoneError.details,
        hint: phoneError.hint,
        code: phoneError.code,
      });
    }
    return { ...app, applicantPhone: phoneError ? null : phone };
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Provider applications</h1>
      <p className="mb-6 text-muted-foreground">
        {applications?.length ?? 0} pending review
      </p>

      {!applications?.length ? (
        <p className="text-muted-foreground">Nothing pending.</p>
      ) : (
        <div className="space-y-4">
          {applicationsWithPhones.map((app) => {
            const applicantName = profilesById.get(app.user_id)?.full_name || app.business_name || "—";
            const phoneDigits = app.applicantPhone?.match(/^\+91(\d{5})(\d{5})$/);
            const formattedPhone = phoneDigits
              ? `+91 ${phoneDigits[1]} ${phoneDigits[2]}`
              : app.applicantPhone;
            const callStatus = app.call_status as CallStatus;

            return (
            <div key={app.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {applicantName} · {app.professional_type}
                  </p>
                  <p className={`text-xs ${profilesById.get(app.user_id)?.phone_verified_at ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {profilesById.get(app.user_id)?.phone_verified_at ? "Phone verified" : "Phone not verified"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {app.city} · {app.years_experience} yrs experience
                  </p>
                </div>
                <ApplicationActions applicationId={app.id} callVerified={callStatus === "verified"} />
              </div>
              <p className="text-sm text-muted-foreground">{app.bio}</p>
              <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Phone call</p>
                    {app.applicantPhone ? (
                      <a className="text-primary underline-offset-4 hover:underline" href={`tel:${app.applicantPhone}`}>
                        {formattedPhone}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No phone number on file</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${callStatusStyles[callStatus]}`}>
                    {callStatusLabels[callStatus]}
                  </span>
                </div>
                {app.call_notes && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{app.call_notes}</p>}
                {app.called_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Called on {new Date(app.called_at).toLocaleDateString("en-IN")}
                  </p>
                )}
                <ApplicationCallDialog
                  applicationId={app.id}
                  applicantName={applicantName}
                  professionalType={app.professional_type}
                  city={app.city}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
