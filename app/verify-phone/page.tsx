import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VerifyPhoneForm } from "@/app/verify-phone/verify-phone-form";
import { PageHeading } from "@/components/page-heading";

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
    <main className="mx-auto w-full max-w-md px-4 pt-0 pb-10">
      <PageHeading title="Verify your phone number" description="Verify your phone number to continue." />
      <VerifyPhoneForm next={next} initialPhone={userData.user.phone ?? undefined} />
    </main>
  );
}
