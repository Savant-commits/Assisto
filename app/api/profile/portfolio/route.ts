import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isOwnStorageUrl } from "@/lib/storage-url";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const requestBody = typeof body === "object" && body !== null ? body : {};
    const imageUrl = "image_url" in requestBody ? requestBody.image_url : undefined;
    const media_type = "media_type" in requestBody && requestBody.media_type === "video" ? "video" : "image";
    const providedCaption = "caption" in requestBody && typeof requestBody.caption === "string"
      ? requestBody.caption.trim()
      : null;
    const fallbackDescription = "description" in requestBody && typeof requestBody.description === "string"
      ? requestBody.description.trim()
      : null;
    const caption = providedCaption || fallbackDescription || null;

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
      return NextResponse.json({ error: "Not authenticated", observedUser: null }, { status: 401 });
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (providerError) {
      return NextResponse.json({ error: providerError.message, observedUser: userData.user.id }, { status: 500 });
    }
    if (!provider) {
      return NextResponse.json({ error: "Not an approved provider", observedUser: userData.user.id }, { status: 403 });
    }

    if (typeof imageUrl !== "string" || !isOwnStorageUrl(imageUrl, "portfolio", userData.user.id)) {
      return NextResponse.json({ error: "Invalid portfolio image URL" }, { status: 400 });
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
        image_url: imageUrl,
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
