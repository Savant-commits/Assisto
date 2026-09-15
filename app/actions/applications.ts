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

  // Parse service labels from the application and insert matching
  // provider_services / provider_categories rows using the admin client.
  // Failures here should not roll back provider creation; log and continue.
  try {
    const raw = application.service_area_notes || "";
    const labels = raw
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    // Track which category_ids we've already inserted this run to avoid duplicates
    const insertedCategoryIds = new Set<number>();

    for (const label of labels) {
      try {
        // Find a service by case-insensitive name match
        const { data: svcMatches, error: svcErr } = await admin
          .from("services")
          .select("id,category_id,name")
          .ilike("name", label)
          .limit(1);

        if (svcErr) {
          console.warn("approveApplication: error looking up service", { applicationId, label, error: svcErr });
          continue;
        }

        const svc = (svcMatches as any[])?.[0];
        if (!svc) {
          console.warn(`approveApplication: no service match for application ${application.id}: "${label}"`);
          continue;
        }

        // Upsert provider_services (provider_id, service_id)
        const { error: upsertSvcErr } = await admin
          .from("provider_services")
          .upsert(
            { provider_id: application.user_id, service_id: svc.id },
            { onConflict: "provider_id,service_id" }
          );

        if (upsertSvcErr) {
          console.warn("approveApplication: failed to insert provider_services", { applicationId, label, error: upsertSvcErr });
        }

        // Ensure provider_categories row exists for this service's category
        const catId = svc.category_id;
        if (catId && !insertedCategoryIds.has(catId)) {
          const { error: upsertCatErr } = await admin
            .from("provider_categories")
            .upsert(
              { provider_id: application.user_id, category_id: catId },
              { onConflict: "provider_id,category_id" }
            );

          if (upsertCatErr) {
            console.warn("approveApplication: failed to insert provider_categories", { applicationId, label, error: upsertCatErr });
          } else {
            insertedCategoryIds.add(catId);
          }
        }
      } catch (innerErr: any) {
        console.warn("approveApplication: error processing label", { applicationId, label, error: innerErr?.message || innerErr });
        // continue to next label
      }
    }
  } catch (err: any) {
    console.warn("approveApplication: failed parsing/inserting service labels", { applicationId, error: err?.message || err });
  }

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
