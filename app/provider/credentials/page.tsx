import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProviderCredentialsManager, { type CredentialTypeOption, type ProviderCredentialItem } from "@/components/provider-credentials-manager";

export default async function ProviderCredentialsPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("credentials auth lookup failed:", userError.message, undefined, undefined, userError.code);
  }

  if (!userData.user) redirect("/login?redirect=/provider/credentials");

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (providerError) {
    console.error("credentials provider lookup failed:", providerError.message, providerError.details, providerError.hint, providerError.code);
  }
  if (!provider) redirect("/");

  const [{ data: credentialTypes, error: typesError }, { data: credentials, error: credentialsError }] = await Promise.all([
    supabase
      .from("credential_types")
      .select("id,slug,label,issuing_body,requires_number,number_label,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("provider_credentials")
      .select("id,credential_type_id,details,credential_number,file_path,status,review_notes,created_at,credential_types(label,issuing_body)")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false }),
  ]);

  if (typesError) {
    console.error("credential types query failed:", typesError.message, typesError.details, typesError.hint, typesError.code);
  }
  if (credentialsError) {
    console.error("provider credentials query failed:", credentialsError.message, credentialsError.details, credentialsError.hint, credentialsError.code);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Manage credentials</h1>
        <p className="text-sm text-muted-foreground">Upload qualifications for review by Assisto.</p>
      </div>
      <ProviderCredentialsManager
        userId={userData.user.id}
        credentialTypes={(credentialTypes ?? []) as CredentialTypeOption[]}
        credentials={(credentials ?? []) as ProviderCredentialItem[]}
      />
    </main>
  );
}
