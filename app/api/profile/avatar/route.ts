import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isOwnStorageUrl } from "@/lib/storage-url";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const AVATAR_TYPES = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10" },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP" },
} as const;

type AvatarStep = "auth" | "validate" | "storage" | "profile-update";
type SupabaseError = { message: string; code?: string; statusCode?: string | number };

function failure(error: string, step: AvatarStep, code: string | number | null, status = 500) {
  return NextResponse.json({ error, step, code }, { status });
}

function supabaseFailure(error: SupabaseError, step: AvatarStep, status = 500) {
  return failure(error.message, step, error.code ?? error.statusCode ?? null, status);
}

function previousAvatarPath(url: string | null, userId: string): string | null {
  if (!url || !isOwnStorageUrl(url, "avatars", userId)) return null;

  try {
    const parsedUrl = new URL(url);
    const prefix = `/storage/v1/object/public/avatars/${encodeURIComponent(userId)}/`;
    if (!parsedUrl.pathname.startsWith(prefix)) return null;

    const filename = decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
    if (!filename || filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..") return null;
    return `${userId}/${filename}`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let step: AvatarStep = "auth";
  try {
    const supabase = await createServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return supabaseFailure(userError, "auth", 401);
    if (!userData?.user) {
      return failure("Not authenticated", "auth", "not_authenticated", 401);
    }

    step = "validate";
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return failure("A multipart form with an image file is required.", "validate", "invalid_form_data", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return failure("Choose an image file to upload.", "validate", "missing_file", 400);
    }
    if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
      return failure("The resized image must be no larger than 4 MB.", "validate", "invalid_file_size", 400);
    }

    const imageType = AVATAR_TYPES[file.type as keyof typeof AVATAR_TYPES];
    if (!imageType) {
      return failure("Choose a JPEG, PNG, or WebP image.", "validate", "unsupported_image_type", 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!imageType.signature(bytes)) {
      return failure("The selected file does not contain valid image data.", "validate", "invalid_image_signature", 400);
    }

    const userId = userData.user.id;
    step = "profile-update";
    const { data: previousProfile, error: previousProfileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (previousProfileError) return supabaseFailure(previousProfileError, "profile-update");

    const path = `${userId}/avatar-${Date.now()}.${imageType.extension}`;
    step = "storage";
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return supabaseFailure(uploadError, "storage");

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    step = "profile-update";
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId)
      .select("avatar_url")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      try {
        await supabase.storage.from("avatars").remove([path]);
      } catch {
        // The profile-update error is the actionable failure to report.
      }
      if (updateError) return supabaseFailure(updateError, "profile-update");
      return failure("Profile not found.", "profile-update", "profile_not_found", 404);
    }

    const oldPath = previousAvatarPath(previousProfile?.avatar_url ?? null, userId);
    if (oldPath && oldPath !== path) {
      try {
        await supabase.storage.from("avatars").remove([oldPath]);
      } catch {
        // Replacing the profile avatar has already succeeded.
      }
    }

    return NextResponse.json({ url: updatedProfile.avatar_url });
  } catch (err: unknown) {
    const message = typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
      ? err.message
      : "Avatar upload failed.";
    const code = typeof err === "object" && err !== null
      ? "code" in err && (typeof err.code === "string" || typeof err.code === "number")
        ? err.code
        : "statusCode" in err && (typeof err.statusCode === "string" || typeof err.statusCode === "number")
          ? err.statusCode
          : null
      : null;
    return failure(message, step, code);
  }
}
