import { NextResponse } from "next/server";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isOwnStorageUrl } from "@/lib/storage-url";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const avatarUrl = typeof body === "object" && body !== null && "avatar_url" in body
      ? body.avatar_url
      : undefined;

    const supabase = await createServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && !isAuthSessionMissingError(userError)) {
      console.error("/api/profile/avatar — auth lookup failed:", {
        message: userError.message,
        code: userError.code,
        details: "details" in userError ? userError.details : undefined,
        hint: "hint" in userError ? userError.hint : undefined,
      });
    }

    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated", observedUser: null }, { status: 401 });
    }

    if (typeof avatarUrl !== "string" || !isOwnStorageUrl(avatarUrl, "avatars", userData.user.id)) {
      return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userData.user.id);

    if (error) {
      console.error("/api/profile/avatar — update error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: error.message, observedUser: userData.user.id }, { status: 500 });
    }

    return NextResponse.json({ ok: true, observedUser: userData.user.id, data });
  } catch (err: unknown) {
    console.error("/api/profile/avatar — unexpected error");
    const message = typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
      ? err.message
      : "Failed to update avatar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
