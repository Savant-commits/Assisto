import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Minimal pass-through middleware to avoid heavy compilation while
// debugging. This prevents the dev server from stalling during middleware
// compilation. Reintroduce the session-refresh proxy when ready.
export default async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
