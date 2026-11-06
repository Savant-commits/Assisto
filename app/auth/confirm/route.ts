import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirectPath(searchParams.get("next"));

  if (!tokenHash || !type) {
    return redirectTo(request, "/login?error=link_expired");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user) {
    return redirectTo(request, "/login?error=link_expired");
  }

  const metadata = data.user.user_metadata ?? {};
  const city = metadata.city === "Chidambaram" ? "Chidambaram" : "Cuddalore";
  const profile = {
    id: data.user.id,
    full_name: typeof metadata.full_name === "string" ? metadata.full_name : "",
    phone: typeof metadata.phone === "string" ? metadata.phone : "",
    city,
    email: data.user.email ?? "",
    role: "customer",
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  if (profileError) {
    console.error("email confirmation profile setup failed", {
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
    });
    return redirectTo(request, "/login?error=profile_setup");
  }

  return redirectTo(request, next);
}
