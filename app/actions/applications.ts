"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Confirms the *current session's* user has role='admin' in profiles,
// using the normal (RLS-respecting) server client — so this check can't
// be spoofed by anything the client sends.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");
  return userData.user.id;
}

export async function approveApplication(applicationId: string) {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const { data: application, error: fetchError } = await admin
    .from("provider_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) throw new Error("Application not found");

  // Two writes, same intent as one unit: mark reviewed, create the public
  // provider row. If the second write fails the application is left
  // 'pending' with reviewed_at set — safe to retry, won't half-publish.
  const { error: appUpdateError } = await admin
    .from("provider_applications")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (appUpdateError) throw appUpdateError;

  const { error: providerError } = await admin.from("providers").insert({
    id: application.user_id,
    application_id: application.id,
    business_name: application.business_name,
    headline: application.professional_type,
    bio: application.bio,
    years_experience: application.years_experience,
    city: application.city,
    is_active: true,
  });

  if (providerError) throw providerError;

  await admin
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", application.user_id);

  revalidatePath("/admin/applications");
  revalidatePath("/discover");
}

export async function rejectApplication(applicationId: string, reason: string) {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("provider_applications")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", applicationId);

  if (error) throw error;
  revalidatePath("/admin/applications");
}
