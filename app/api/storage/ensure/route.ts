import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const validBuckets = new Set(["avatars", "portfolio"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const bucket = typeof body?.bucket === "string" ? body.bucket : null;

    if (!bucket || !validBuckets.has(bucket)) {
      return NextResponse.json({ error: "Invalid storage bucket." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const exists = buckets?.some((item) => item.name === bucket);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
    } else {
      // If the bucket exists, ensure it's public. Some Supabase projects
      // create buckets as private by default — that causes upload/URL issues
      // from the browser. Use the admin client to check and update the bucket.
      try {
        const { data: bucketInfo, error: getError } = await supabase.storage.getBucket(bucket);
        if (getError) {
          return NextResponse.json({ error: getError.message }, { status: 500 });
        }

        if (bucketInfo && (bucketInfo as any).public !== true) {
          const { error: updateError } = await supabase.storage.updateBucket(bucket, { public: true });
          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }
        }
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Failed to ensure bucket visibility." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, bucket, created: !exists });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to prepare storage bucket." },
      { status: 500 }
    );
  }
}
