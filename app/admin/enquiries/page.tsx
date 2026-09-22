import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminEnquiryDetail from "@/components/admin-enquiry-detail";
import AdminEnquiriesTabs from "@/components/admin-enquiries-tabs";

export default async function AdminEnquiriesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/enquiries");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: enquiries, error: enquiriesError } = await supabase
    .from("enquiries")
    .select(`id,enquiry_code,message,status,created_at,updated_at,customer_id,provider_id,accepted_at,declined_at,completed_at,contact_unlocked_at,profiles!enquiries_customer_id_fkey(full_name,user_code),providers(id,business_name,profiles!providers_id_fkey(user_code)),customer_requirements(description),admin_note,admin_cancel_reason,admin_cancelled_at,admin_cancelled_by`)
    .order("created_at", { ascending: false });

  if (enquiriesError) {
    console.error("enquiries query failed:", {
      message: enquiriesError.message,
      details: enquiriesError.details,
      hint: enquiriesError.hint,
      code: enquiriesError.code,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Enquiries (admin)</h1>
      <p className="mb-6 text-muted-foreground">{enquiries?.length ?? 0} enquiries</p>

      <AdminEnquiriesTabs enquiries={enquiries || []} />
    </div>
  );
}
