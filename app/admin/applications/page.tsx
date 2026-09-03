import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationActions } from "@/components/application-actions";

export default async function AdminApplicationsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/applications");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  // Page-level guard for UX (hide the page from non-admins). The real
  // security boundary is requireAdmin() inside the server actions —
  // this redirect alone is not what protects the writes.
  if (profile?.role !== "admin") redirect("/");

  const { data: applications } = await supabase
    .from("provider_applications")
    .select("id, professional_type, business_name, bio, city, years_experience, created_at, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

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
          {applications.map((app) => (
            <div key={app.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {app.business_name || "—"} · {app.professional_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {app.city} · {app.years_experience} yrs experience
                  </p>
                </div>
                <ApplicationActions applicationId={app.id} />
              </div>
              <p className="text-sm text-muted-foreground">{app.bio}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
