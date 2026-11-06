import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function requiresAuthentication(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/enquiries" ||
    pathname === "/my-enquiries" ||
    pathname === "/your-work" ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/verify-phone"
  );
}

export async function proxy(request: NextRequest) {
  const nextResponse = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let response = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();

  const isEmailConfirmed = Boolean(userData.user?.email_confirmed_at);
  if ((!userData.user || !isEmailConfirmed) && requiresAuthentication(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", redirectPath);

    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
