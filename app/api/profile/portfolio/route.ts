import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const image_url = typeof body?.image_url === "string" ? body.image_url : null;
    const media_type = body?.media_type === "video" ? "video" : "image";
    const providedCaption = typeof body?.caption === "string" ? body.caption.trim() : null;
    const fallbackDescription = typeof body?.description === "string" ? body.description.trim() : null;
    const caption = providedCaption || fallbackDescription || null;

    if (!image_url) {
      return NextResponse.json({ error: "Missing image_url" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated", observedUser: null }, { status: 401 });
    }

    const { data: maxSortData, error: maxSortError } = await supabase
      .from("provider_portfolio_items")
      .select("sort_order")
      .eq("provider_id", userData.user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxSortError) {
      return NextResponse.json({ error: maxSortError.message, observedUser: userData.user.id }, { status: 500 });
    }

    const sort_order = typeof maxSortData?.sort_order === "number" ? maxSortData.sort_order + 1 : 1;

    const { data, error } = await supabase
      .from("provider_portfolio_items")
      .insert({
        provider_id: userData.user.id,
        image_url,
        media_type,
        caption,
        description: caption,
        sort_order,
        created_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message, observedUser: userData.user.id }, { status: 500 });
    }

    return NextResponse.json({ ok: true, observedUser: userData.user.id, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save portfolio item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
