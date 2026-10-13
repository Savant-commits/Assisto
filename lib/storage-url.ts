export function isOwnStorageUrl(url: unknown, bucket: string, userId: string): boolean {
  if (typeof url !== "string") return false;

  try {
    const parsedUrl = new URL(url);
    const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredSupabaseUrl) return false;

    const configuredOrigin = new URL(configuredSupabaseUrl).origin;
    if (
      parsedUrl.origin !== configuredOrigin ||
      parsedUrl.username !== "" ||
      parsedUrl.password !== "" ||
      parsedUrl.port !== "" ||
      url.includes("\\") ||
      /%(?:2f|5c)/i.test(url)
    ) {
      return false;
    }

    const rawPathMatch = url.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i);
    const rawPath = rawPathMatch?.[1] ?? "";
    const pathSegments = [...rawPath.split("/"), ...parsedUrl.pathname.split("/")];
    for (const segment of pathSegments) {
      if (decodeURIComponent(segment) === "..") return false;
    }

    const expectedPrefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(userId)}/`;
    return parsedUrl.pathname.startsWith(expectedPrefix);
  } catch {
    return false;
  }
}
