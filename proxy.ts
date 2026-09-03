import * as AuthHelpers from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-compatible middleware to refresh Supabase session cookies.
// Uses `createMiddlewareClient` which is designed for Next.js Edge middleware.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  try {
    // Some package versions expose the helper differently; guard the call.
    const createMiddlewareClient = (AuthHelpers as any).createMiddlewareClient;
    if (typeof createMiddlewareClient === "function") {
      const supabase = createMiddlewareClient({ req: request, res: response });

      // `getUser` / `getSession` will cause the helper to refresh tokens when required
      // and will set cookies on the response object.
      await supabase.auth.getUser();
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "proxy: createMiddlewareClient not available from @supabase/auth-helpers-nextjs; skipping session refresh"
      );
    }
  } catch (err) {
    // Don't block the request on middleware failures; log discreetly.
    // In development this avoids hard hangs — real monitoring should capture this.
    // eslint-disable-next-line no-console
    console.warn("middleware: supabase session refresh failed", err);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
