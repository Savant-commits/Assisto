import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationActions } from "@/components/application-actions";
import { ApplicationCallDialog, CallRecordingPlayer } from "@/components/application-call-dialog";
import { CredentialReviewActions } from "@/components/credential-review-actions";

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
type ApplicantCredential = {
  id: string;
  provider_id: string;
  details: string | null;
  credential_number: string | null;
  issuer: string | null;
  file_path: string | null;
  status: "pending" | "verified" | "rejected" | "revoked";
  review_notes: string | null;
  created_at: string;
  credential_types?: { label: string; issuing_body: string | null } | { label: string; issuing_body: string | null }[] | null;
};

function getCredentialType(credential: ApplicantCredential) {
  return Array.isArray(credential.credential_types)
    ? credential.credential_types[0] ?? null
    : credential.credential_types ?? null;
}

const credentialStatusLabels = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  revoked: "Revoked",
} as const;
const credentialStatusStyles = {
  pending: "bg-gray-100 text-gray-700",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  revoked: "bg-red-100 text-red-800",
} as const;

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
    .select("id, user_id, professional_type, business_name, bio, city, years_experience, service_area_notes, created_at, status, call_status, call_notes, called_at, call_recording_path")
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
  const { data: credentialRows, error: credentialsError } = userIds.length
    ? await supabase
      .from("provider_credentials")
      .select("id, provider_id, details, credential_number, issuer, file_path, status, review_notes, created_at, credential_types(label, issuing_body)")
      .in("provider_id", userIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (credentialsError) {
    console.error("admin applications: failed to load applicant credentials", {
      message: credentialsError.message,
      details: credentialsError.details,
      hint: credentialsError.hint,
      code: credentialsError.code,
    });
  }
  const credentialsByApplicant = new Map<string, ApplicantCredential[]>();
  for (const credential of (credentialRows ?? []) as ApplicantCredential[]) {
    const group = credentialsByApplicant.get(credential.provider_id) ?? [];
    group.push(credential);
    credentialsByApplicant.set(credential.provider_id, group);
  }
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
            const fullName = profilesById.get(app.user_id)?.full_name;
            const applicantName = fullName || app.business_name || "—";
            const phoneDigits = app.applicantPhone?.match(/^\+91(\d{5})(\d{5})$/);
            const formattedPhone = phoneDigits
              ? `+91 ${phoneDigits[1]} ${phoneDigits[2]}`
              : app.applicantPhone;
            const callStatus = app.call_status as CallStatus;
            const applicantCredentials = credentialsByApplicant.get(app.user_id) ?? [];
            const credentialDialogDetails = applicantCredentials.map((credential) => ({
              id: credential.id,
              label: getCredentialType(credential)?.label ?? "Credential",
              filePath: credential.file_path,
            }));

            return (
              <div key={app.id} className="min-w-0 rounded-lg border p-4">
                <div className="mb-2 flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-words font-medium [overflow-wrap:anywhere]">
                      {applicantName} · {app.professional_type}
                    </p>
                    <p className={`text-xs ${profilesById.get(app.user_id)?.phone_verified_at ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                      {profilesById.get(app.user_id)?.phone_verified_at ? "Phone verified" : "Phone not verified"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {app.city} · {app.years_experience ?? "Not stated"} {app.years_experience === 1 ? "year" : "years"} experience
                    </p>
                  </div>
                  <ApplicationActions applicationId={app.id} callVerified={callStatus === "verified"} />
                </div>
                <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{app.bio}</p>
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
                  {app.call_notes && <p className="mt-2 break-words whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{app.call_notes}</p>}
                  {app.called_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Called on {new Date(app.called_at).toLocaleDateString("en-IN")}
                    </p>
                  )}
                  {app.call_recording_path && <CallRecordingPlayer recordingPath={app.call_recording_path} />}
                  <ApplicationCallDialog
                    applicationId={app.id}
                    applicantName={fullName || "Not stated"}
                    professionalType={app.professional_type}
                    city={app.city}
                    businessName={app.business_name}
                    yearsExperience={app.years_experience}
                    serviceAreaNotes={app.service_area_notes}
                    bio={app.bio}
                    credentials={credentialDialogDetails}
                  />
                </div>
                <section className="mt-4 rounded-md border p-3">
                  <h2 className="mb-2 font-medium">Credentials</h2>
                  {!applicantCredentials.length ? (
                    <p className="text-sm text-muted-foreground">No credentials submitted. Credentials are optional.</p>
                  ) : (
                    <div className="space-y-3">
                      {applicantCredentials.map((credential) => {
                        const type = getCredentialType(credential);
                        return (
                          <article key={credential.id} className="min-w-0 rounded border p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="break-words font-medium [overflow-wrap:anywhere]">{type?.label ?? "Credential"}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${credentialStatusStyles[credential.status]}`}>
                                {credentialStatusLabels[credential.status]}
                              </span>
                            </div>
                            {credential.credential_number && <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">Number: {credential.credential_number}</p>}
                            {credential.issuer && <p className="break-words text-sm [overflow-wrap:anywhere]">Issuer: {credential.issuer}</p>}
                            {credential.details && <p className="mt-1 break-words whitespace-pre-line text-sm text-muted-foreground [overflow-wrap:anywhere]">{credential.details}</p>}
                            {credential.review_notes && <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">Review notes: {credential.review_notes}</p>}
                            <div className="mt-2">
                              <CredentialReviewActions credential={credential} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
