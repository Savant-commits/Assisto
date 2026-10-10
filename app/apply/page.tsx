import ApplyForm from "@/components/apply-form";
import ProviderCredentialsManager, {
  type CredentialTypeOption,
  type ProviderCredentialItem,
} from "@/components/provider-credentials-manager";
import { createClient } from "@/lib/supabase/server";

type CredentialTypeRow = CredentialTypeOption;

export default async function ApplyPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("apply page auth lookup failed", {
      message: userError.message,
      details: "details" in userError ? userError.details : undefined,
      hint: "hint" in userError ? userError.hint : undefined,
      code: userError.code,
    });
  }

  if (!userData.user) {
    return <ApplyForm />;
  }

  const userId = userData.user.id;
  const [{ data: provider, error: providerError }, { data: application, error: applicationError }] = await Promise.all([
    supabase.from("providers").select("id").eq("id", userId).maybeSingle(),
    supabase
      .from("provider_applications")
      .select("id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (providerError) {
    console.error("apply page provider lookup failed", {
      message: providerError.message,
      details: providerError.details,
      hint: providerError.hint,
      code: providerError.code,
    });
  }
  if (applicationError) {
    console.error("apply page application lookup failed", {
      message: applicationError.message,
      details: applicationError.details,
      hint: applicationError.hint,
      code: applicationError.code,
    });
  }

  let credentialTypes: CredentialTypeOption[] = [];
  let credentials: ProviderCredentialItem[] = [];
  const shouldShowCredentials = !!provider || application?.status === "pending";
  if (shouldShowCredentials) {
    const [typesResult, credentialsResult] = await Promise.all([
      supabase
        .from("credential_types")
        .select("id,slug,label,issuing_body,requires_number,number_label,requires_details,requires_issuer,details_label,issuer_label,hint,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("provider_credentials")
        .select("id,credential_type_id,details,credential_number,issuer,file_path,status,review_notes,created_at,credential_types(label,issuing_body)")
        .eq("provider_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (typesResult.error) {
      console.error("apply page credential types query failed", {
        message: typesResult.error.message,
        details: typesResult.error.details,
        hint: typesResult.error.hint,
        code: typesResult.error.code,
      });
    }
    if (credentialsResult.error) {
      console.error("apply page credentials query failed", {
        message: credentialsResult.error.message,
        details: credentialsResult.error.details,
        hint: credentialsResult.error.hint,
        code: credentialsResult.error.code,
      });
    }
    credentialTypes = (typesResult.data ?? []) as CredentialTypeRow[];
    credentials = (credentialsResult.data ?? []) as ProviderCredentialItem[];
  }

  return (
    <>
      <ApplyForm />
      {shouldShowCredentials && (
        <div className="mx-auto max-w-3xl px-4 pb-12">
          <section id="credentials" className="space-y-4 rounded-lg border p-6">
            <div>
              <h2 className="mb-1 text-xl font-semibold">Credentials</h2>
              <p className="text-sm text-muted-foreground">
                Optional. Upload documents such as a business registration, an association membership card or a skill certificate. Assisto checks them, and verified ones show on your profile. If you have just applied, we will look at them during your verification call.
              </p>
            </div>
            <ProviderCredentialsManager userId={userId} credentialTypes={credentialTypes} credentials={credentials} />
          </section>
        </div>
      )}
    </>
  );
}
