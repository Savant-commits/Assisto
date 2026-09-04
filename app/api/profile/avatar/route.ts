import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const avatar_url = typeof body?.avatar_url === "string" ? body.avatar_url : null;

    if (!avatar_url) {
      return NextResponse.json({ error: "Missing avatar_url" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    // Log for debugging — remove in production
    console.log("/api/profile/avatar — auth.getUser():", { userData, userError });

    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated", observedUser: null }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", userData.user.id);

    if (error) {
      console.error("/api/profile/avatar — update error:", error);
      return NextResponse.json({ error: error.message, observedUser: userData.user.id }, { status: 500 });
    }

    return NextResponse.json({ ok: true, observedUser: userData.user.id, data });
  } catch (err: any) {
    console.error("/api/profile/avatar — unexpected:", err);
    return NextResponse.json({ error: err?.message || "Failed to update avatar" }, { status: 500 });
  }
}
