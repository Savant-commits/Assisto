import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCredentialsList, { type AdminCredentialItem } from "@/components/admin-credentials-list";

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ credential?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("admin credentials auth lookup failed:", userError.message, undefined, undefined, userError.code);
  }
  if (!userData.user) redirect("/login?redirect=/admin/credentials");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("admin credentials role lookup failed:", profileError.message, profileError.details, profileError.hint, profileError.code);
  }
  if (profile?.role !== "admin") redirect("/");

  const { data: rows, error: credentialsError } = await supabase
    .from("provider_credentials")
    .select(
      "id,provider_id,details,credential_number,file_path,status,review_notes,reviewed_at,created_at,credential_types(label,issuing_body),providers!provider_credentials_provider_id_fkey(id,business_name,city,profiles!providers_id_fkey(full_name,user_code))"
    )
    .order("created_at", { ascending: false });

  if (credentialsError) {
    console.error("admin credentials query failed:", credentialsError.message, credentialsError.details, credentialsError.hint, credentialsError.code);
  }

  const params = await searchParams;
  const credential = Array.isArray(params.credential) ? params.credential[0] : params.credential;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Provider credentials</h1>
      <p className="mb-6 text-sm text-muted-foreground">Review uploaded certificates, degrees and licences.</p>
      <AdminCredentialsList credentials={(rows ?? []) as AdminCredentialItem[]} deepLinkCredentialId={credential ?? null} />
    </main>
  );
}
