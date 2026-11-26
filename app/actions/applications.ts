"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhoneVerificationRequired } from "@/lib/phone-verification-required";

// Confirms the *current session's* user has role='admin' in profiles,
// using the normal (RLS-respecting) server client — so this check can't
// be spoofed by anything the client sends.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not signed in");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError) throw profileError;

  if (profile?.role !== "admin") throw new Error("Not authorized");
  return userData.user.id;
}

type ApplicationService = { id: string; category_id: string | null };
export type ApprovalResult = {
  servicesLinked: number;
  categoriesLinked: number;
  unmatchedLabels: string[];
  failedWrites: number;
};

async function linkApplicationServices(
  admin: ReturnType<typeof createAdminClient>,
  application: { id: string; user_id: string; service_ids?: string[] | null; service_area_notes?: string | null }
): Promise<ApprovalResult> {
  const result: ApprovalResult = {
    servicesLinked: 0,
    categoriesLinked: 0,
    unmatchedLabels: [],
    failedWrites: 0,
  };
  const servicesById = new Map<string, ApplicationService>();
  const requestedIds = [...new Set(application.service_ids ?? [])];

  if (requestedIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("services")
        .select("id,category_id")
        .in("id", requestedIds);
      if (error) {
        console.warn("approveApplication: failed to load selected services", { applicationId: application.id, error });
        result.unmatchedLabels.push(...requestedIds.map((id) => `Service ID ${id}`));
      } else {
        for (const service of (data ?? []) as ApplicationService[]) servicesById.set(service.id, service);
        const foundIds = new Set(servicesById.keys());
        result.unmatchedLabels.push(...requestedIds.filter((id) => !foundIds.has(id)).map((id) => `Service ID ${id}`));
      }
    } catch (error: unknown) {
      console.warn("approveApplication: service lookup threw", { applicationId: application.id, error });
      result.unmatchedLabels.push(...requestedIds.map((id) => `Service ID ${id}`));
    }
  } else {
    const labels = (application.service_area_notes ?? "")
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);

    for (const label of labels) {
      try {
        const escapedLabel = label.replace(/[\\%_]/g, "\\$&");
        const { data, error } = await admin
          .from("services")
          .select("id,category_id")
          .ilike("name", escapedLabel)
          .limit(1);
        if (error) {
          console.warn("approveApplication: legacy service lookup failed", { applicationId: application.id, label, error });
          result.unmatchedLabels.push(label);
          continue;
        }

        const service = (data ?? [])[0] as ApplicationService | undefined;
        if (!service) {
          result.unmatchedLabels.push(label);
          continue;
        }
        servicesById.set(service.id, service);
      } catch (error: unknown) {
        console.warn("approveApplication: legacy service lookup threw", { applicationId: application.id, label, error });
        result.unmatchedLabels.push(label);
      }
    }
  }

  const serviceRows = [...servicesById.keys()].map((serviceId) => ({
    provider_id: application.user_id,
    service_id: serviceId,
  }));
  if (serviceRows.length) {
    try {
      const { error } = await admin
        .from("provider_services")
        .upsert(serviceRows, { onConflict: "provider_id,service_id" });
      if (error) {
        console.warn("approveApplication: failed to upsert provider services", { applicationId: application.id, error });
        result.failedWrites += 1;
      } else {
        result.servicesLinked = serviceRows.length;
      }
    } catch (error: unknown) {
      console.warn("approveApplication: provider service upsert threw", { applicationId: application.id, error });
      result.failedWrites += 1;
    }
  }

  const categoryIds = [...new Set([...servicesById.values()].flatMap((service) => service.category_id ? [service.category_id] : []))];
  const categoryRows = categoryIds.map((categoryId) => ({
    provider_id: application.user_id,
    category_id: categoryId,
  }));
  if (categoryRows.length) {
    try {
      const { error } = await admin
        .from("provider_categories")
        .upsert(categoryRows, { onConflict: "provider_id,category_id" });
      if (error) {
        console.warn("approveApplication: failed to upsert provider categories", { applicationId: application.id, error });
        result.failedWrites += 1;
      } else {
        result.categoriesLinked = categoryRows.length;
      }
    } catch (error: unknown) {
      console.warn("approveApplication: provider category upsert threw", { applicationId: application.id, error });
      result.failedWrites += 1;
    }
  }

  result.unmatchedLabels = [...new Set(result.unmatchedLabels)];
  return result;
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
  if (application.status !== "pending") {
    throw new Error("This application has already been decided");
  }

  const { data: applicantProfile, error: applicantProfileError } = await admin
    .from("profiles")
    .select("phone_verified_at")
    .eq("id", application.user_id)
    .single();
  if (applicantProfileError) throw applicantProfileError;
  const phoneVerificationRequired = await getPhoneVerificationRequired();
  if (phoneVerificationRequired && !applicantProfile?.phone_verified_at) {
    throw new Error("Applicant's phone number is not verified.");
  }
  if (application.call_status !== "verified") {
    throw new Error("Call the applicant and record a verified result before approving.");
  }

  // Mark reviewed first, then create the public provider row. Restore the
  // application to pending if provider creation fails so an admin can retry.
  const { data: updatedApplication, error: appUpdateError } = await admin
    .from("provider_applications")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (appUpdateError) {
    if (appUpdateError.message.includes("CALL_NOT_VERIFIED")) {
      throw new Error("Call the applicant and record a verified result before approving.");
    }
    throw appUpdateError;
  }
  if (!updatedApplication) {
    throw new Error("This application has already been decided");
  }

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

  if (providerError) {
    const { data: rolledBackApplication, error: rollbackError } = await admin
      .from("provider_applications")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", applicationId)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (rollbackError || !rolledBackApplication) {
      console.error("approveApplication: failed to restore application after provider insert failure", rollbackError);
      throw new Error(`${providerError.message}; application could not be restored to pending`);
    }
    if (providerError.message.includes("CALL_NOT_VERIFIED")) {
      throw new Error("Call the applicant and record a verified result before approving.");
    }
    throw providerError;
  }

  const serviceResult = await linkApplicationServices(admin, application);

  const { error: roleUpdateError } = await admin
    .from("profiles")
    .update({ role: "provider" })
    .eq("id", application.user_id);
  if (roleUpdateError) throw roleUpdateError;

  revalidatePath("/admin/applications");
  revalidatePath("/discover");
  return serviceResult;
}

export async function rejectApplication(applicationId: string, reason: string) {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const { data: application, error: fetchError } = await admin
    .from("provider_applications")
    .select("status")
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!application) throw new Error("Application not found");
  if (application.status !== "pending") {
    throw new Error("This application has already been decided");
  }

  const { data: updatedApplication, error } = await admin
    .from("provider_applications")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!updatedApplication) {
    throw new Error("This application has already been decided");
  }
  revalidatePath("/admin/applications");
}
