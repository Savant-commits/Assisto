import type { SupabaseClient } from "@supabase/supabase-js";

type SaveEnquiryLocationInput = {
  enquiryId: number;
  customerId: string;
  addressText: string;
  lat: number | null;
  lng: number | null;
};

export async function saveEnquiryLocation(
  supabase: SupabaseClient,
  { enquiryId, customerId, addressText, lat, lng }: SaveEnquiryLocationInput,
) {
  const insertPayload = {
    enquiry_id: enquiryId,
    customer_id: customerId,
    address_text: addressText,
  };
  const hasCoordinates = typeof lat === "number" && typeof lng === "number";
  const { error: insertError } = hasCoordinates
    ? await supabase.from("enquiry_locations").insert({ ...insertPayload, lat, lng })
    : await supabase.from("enquiry_locations").insert(insertPayload);
  if (!insertError || insertError.code !== "23505") return insertError;

  const locationUpdate = hasCoordinates
    ? supabase.from("enquiry_locations").update({ address_text: addressText, lat, lng })
    : supabase.from("enquiry_locations").update({ address_text: addressText });
  const { error: updateError } = await locationUpdate.eq("enquiry_id", enquiryId);
  return updateError;
}