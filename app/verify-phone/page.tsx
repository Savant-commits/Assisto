import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VerifyPhoneForm } from "@/app/verify-phone/verify-phone-form";

function safeNext(value: string | string[] | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !value.includes("://")
  ) {
    return value;
  }
  return "/";
}

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = safeNext(nextParam);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_verified_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.phone_verified_at) redirect(next);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Verify your phone number</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Verify your phone number to continue.
      </p>
      <VerifyPhoneForm next={next} initialPhone={userData.user.phone ?? undefined} />
    </main>
  );
}
