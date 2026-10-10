import { createClient } from "@/lib/supabase/server";
import ProviderCredentialsManager, {
  type CredentialTypeOption,
  type ProviderCredentialItem,
} from "@/components/provider-credentials-manager";

export default async function ApplySubmittedPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("apply submitted auth lookup failed", {
      message: userError.message,
      details: "details" in userError ? userError.details : undefined,
      hint: "hint" in userError ? userError.hint : undefined,
      code: userError.code,
    });
  }

  let credentialTypes: CredentialTypeOption[] = [];
  let credentials: ProviderCredentialItem[] = [];
  let pendingUserId: string | null = null;
  if (userData.user) {
    const { data: application, error: applicationError } = await supabase
      .from("provider_applications")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (applicationError) {
      console.error("apply submitted pending application lookup failed", {
        message: applicationError.message,
        details: applicationError.details,
        hint: applicationError.hint,
        code: applicationError.code,
      });
    }

    if (application) {
      pendingUserId = userData.user.id;
      const [typesResult, credentialsResult] = await Promise.all([
        supabase
          .from("credential_types")
          .select("id,slug,label,issuing_body,requires_number,number_label,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("provider_credentials")
          .select("id,credential_type_id,details,credential_number,file_path,status,review_notes,created_at,credential_types(label,issuing_body)")
          .eq("provider_id", userData.user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (typesResult.error) {
        console.error("apply submitted credential types query failed", {
          message: typesResult.error.message,
          details: typesResult.error.details,
          hint: typesResult.error.hint,
          code: typesResult.error.code,
        });
      }
      if (credentialsResult.error) {
        console.error("apply submitted credentials query failed", {
          message: credentialsResult.error.message,
          details: credentialsResult.error.details,
          hint: credentialsResult.error.hint,
          code: credentialsResult.error.code,
        });
      }
      credentialTypes = (typesResult.data ?? []) as CredentialTypeOption[];
      credentials = (credentialsResult.data ?? []) as ProviderCredentialItem[];
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Application received</h1>
      <p className="text-muted-foreground">
        We&apos;ll review your details and call you on the phone number you verified to confirm your application. Please keep your phone on. Once you are approved, your profile goes live and customers in your area can find you.
      </p>
      {pendingUserId && (
        <section className="mt-8 space-y-3 text-left">
          <div>
            <h2 className="mb-1 text-lg font-semibold">Add credentials (optional)</h2>
            <p className="text-sm text-muted-foreground">
              You can upload documents now, for example a business registration, an association membership card or a skill certificate. We will look at them during your verification call. This is optional.
            </p>
          </div>
          <ProviderCredentialsManager
            userId={pendingUserId}
            credentialTypes={credentialTypes}
            credentials={credentials}
          />
        </section>
      )}
    </div>
  );
}
