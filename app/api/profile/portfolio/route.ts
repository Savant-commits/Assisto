import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const image_url = typeof body?.image_url === "string" ? body.image_url : null;
    const media_type = body?.media_type === "video" ? "video" : "image";
    const description = typeof body?.description === "string" ? body.description : null;

    if (!image_url) {
      return NextResponse.json({ error: "Missing image_url" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated", observedUser: null }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("provider_portfolio_items")
      .insert({
        provider_id: userData.user.id,
        image_url,
        media_type,
        description,
        created_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message, observedUser: userData.user.id }, { status: 500 });
    }

    return NextResponse.json({ ok: true, observedUser: userData.user.id, data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save portfolio item" }, { status: 500 });
  }
}
