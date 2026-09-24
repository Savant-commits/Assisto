import type { SupabaseClient } from "@supabase/supabase-js";

export type EligibleReviewEnquiry = {
  id: number;
  customer_id: string;
  provider_id: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  customer_completed_at: string | null;
  customer_requirements?: { description: string | null } | null;
  providers?: { id: string; business_name?: string | null } | null;
};

export async function getEligibleEnquiriesForReview(
  supabase: SupabaseClient,
  customerId: string,
  providerId?: string
): Promise<EligibleReviewEnquiry[]> {
  let query = supabase
    .from("enquiries")
    .select(
      `id, customer_id, provider_id, status, created_at, updated_at, customer_completed_at, customer_requirements(description), providers(id, business_name)`
    )
    .eq("customer_id", customerId)
    .eq("status", "completed")
    .order("customer_completed_at", { ascending: false });

  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const enquiryRows = (data as EligibleReviewEnquiry[] | null) ?? [];
  if (enquiryRows.length === 0) {
    return [];
  }

  const enquiryIds = enquiryRows.map((enquiry) => String(enquiry.id));

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("enquiry_id")
    .eq("customer_id", customerId)
    .in("enquiry_id", enquiryIds);

  if (reviewError) {
    throw reviewError;
  }

  const reviewedIds = new Set((reviewRows ?? []).map((row) => String(row.enquiry_id)));

  return enquiryRows.filter((enquiry) => !reviewedIds.has(String(enquiry.id)));
}
