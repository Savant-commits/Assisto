import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminEnquiryDetail from "@/components/admin-enquiry-detail";

export default async function AdminEnquiriesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/enquiries");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: enquiries } = await supabase
    .from("enquiries")
    .select(`id,message,status,created_at,updated_at,customer_id,provider_id,profiles(full_name),providers(id,business_name),customer_requirements(description),admin_note,admin_cancel_reason,admin_cancelled_at,admin_cancelled_by`)
    .order("created_at", { ascending: false });

  const tabs = [
    { key: "active_services", label: "Active services", statuses: ["confirmed"] },
    { key: "active_enquiries", label: "Active enquiries", statuses: ["sent"] },
    { key: "completed", label: "Completed", statuses: ["completed"] },
    { key: "cancelled", label: "Cancelled", statuses: ["declined"] },
    { key: "withdrawn", label: "Withdrawn", statuses: ["cancelled"] },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Enquiries (admin)</h1>
      <p className="mb-6 text-muted-foreground">{enquiries?.length ?? 0} enquiries</p>

      <div className="space-y-6">
        {tabs.map((t) => {
          const rows = (enquiries || []).filter((e: any) => t.statuses.includes(e.status));
          return (
            <section key={t.key}>
              <h2 className="mb-2 text-lg font-medium">{t.label}</h2>
              {!rows.length ? (
                <div className="rounded-lg border p-4 text-muted-foreground">No items</div>
              ) : (
                <div className="space-y-4">
                  {rows.map((enq: any) => (
                    <div key={enq.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{enq.profiles?.full_name || enq.customer_id}</p>
                          {enq.customer_requirements?.description && (
                            <p className="mt-1 text-sm text-muted-foreground">Regarding: {enq.customer_requirements.description}</p>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{enq.status}</div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{enq.message}</p>
                      <AdminEnquiryDetail enquiry={enq} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
