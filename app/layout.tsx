import type { Metadata } from "next";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { Fraunces } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inspect } from "node:util";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import SessionMenu from "@/components/session-menu";
import { EnquiriesNavBadge } from "@/components/enquiries-nav-badge";
import NotificationBell from "@/components/notification-bell";
import BanGate from "@/components/ban-gate";
import { PhoneVerifyBanner } from "@/components/phone-verify-banner";
import { PhoneVerificationRequiredProvider } from "@/components/phone-verification-required-context";
import { getPhoneVerificationRequired } from "@/lib/phone-verification-required";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import AppHeader from "@/components/shell/app-header";
import BottomNav from "@/components/shell/bottom-nav";
import { NotificationsProvider } from "@/components/notification-bell";
import { getSelectedLocation } from "@/lib/location/server";
import { LocationProvider } from "@/lib/location/provider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assisto — Find the right person for the job",
  description: "Describe what you need and discover approved local professionals in Cuddalore and Chidambaram. You choose who to work with.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !isAuthSessionMissingError(userError)) {
    console.error("layout auth lookup failed", {
      message: userError.message,
      details: "details" in userError ? userError.details : undefined,
      hint: "hint" in userError ? userError.hint : undefined,
      code: userError.code,
    });
  }
  let profile: { full_name?: string; avatar_url?: string | null; role?: string | null; phone_verified_at?: string | null } | null = null;
  let isProvider = false;
  let profileLookupFailed = false;
  let phoneVerificationRequired = true;
  try {
    phoneVerificationRequired = await getPhoneVerificationRequired();
    if (userData.user) {
      const [{ data, error: profileError }, { data: provider, error: providerError }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, role, phone_verified_at").eq("id", userData.user.id).single(),
        supabase.from("providers").select("id").eq("id", userData.user.id).maybeSingle(),
      ]);
      if (profileError) {
        profileLookupFailed = true;
        console.error("layout profile lookup failed", {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
          name: profileError.name,
          status: "status" in profileError ? profileError.status : undefined,
          stringified: String(profileError),
          inspected: inspect(profileError, { depth: 5 }),
          typeof: typeof profileError,
          select: "full_name, avatar_url, role, phone_verified_at",
        });
      }
      if (providerError) {
        console.error("layout provider lookup failed", {
          message: providerError.message,
          details: providerError.details,
          hint: providerError.hint,
          code: providerError.code,
        });
      }
      profile = data || null;
      isProvider = !!provider;
    }
  } catch (error) {
    const errorInfo = error && typeof error === "object"
      ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
      : {};
    console.error("layout profile lookup failed", {
      message: errorInfo.message ?? String(error),
      details: errorInfo.details,
      hint: errorInfo.hint,
      code: errorInfo.code,
    });
    profileLookupFailed = true;
    phoneVerificationRequired = true;
  }

  if (
    process.env.REQUIRE_PHONE_VERIFICATION === "true" &&
    userData.user &&
    profile &&
    profileLookupFailed === false &&
    profile.role !== "admin" &&
    profile.phone_verified_at == null
  ) {
    let verificationRedirect: string | null = null;
    try {
      const currentPath = (await headers()).get("x-pathname");
      if (currentPath) {
        const pathname = currentPath.split("?")[0].replace(/\/+$/, "") || "/";
        const exemptPath =
          pathname === "/verify-phone" ||
          pathname === "/login" ||
          pathname === "/signup" ||
          pathname === "/auth" ||
          pathname.startsWith("/auth/") ||
          pathname === "/api" ||
          pathname.startsWith("/api/") ||
          pathname === "/_next" ||
          pathname.startsWith("/_next/") ||
          /(^|\/)[^/]+\.[^/]+$/.test(pathname);

        if (!exemptPath) {
          verificationRedirect = `/verify-phone?next=${encodeURIComponent(currentPath)}`;
        }
      }
    } catch (error) {
      const errorInfo = error && typeof error === "object"
        ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
        : {};
      console.error("layout phone verification redirect check failed", {
        message: errorInfo.message ?? String(error),
        details: errorInfo.details,
        hint: errorInfo.hint,
        code: errorInfo.code,
      });
    }

    if (verificationRedirect) redirect(verificationRedirect);
  }

  const currentPath = (await headers()).get("x-pathname") || "/";
  const pathname = currentPath.split("?")[0];
  const isMainTabRoute = ["/", "/discover", "/enquiries", "/profile"].includes(pathname);
  const selectedLocation = await getSelectedLocation();

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LocationProvider key={JSON.stringify(selectedLocation)} initialLocation={selectedLocation}>
        <PhoneVerificationRequiredProvider required={phoneVerificationRequired}>
        {isMainTabRoute ? (
          userData.user ? (
            <NotificationsProvider>
              <AppHeader
                currentPath={currentPath}
                fullName={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                isLoggedIn
              />
              {phoneVerificationRequired && userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
              <div style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}>
                {children}
              </div>
              <BottomNav currentPath={pathname} isLoggedIn />
            </NotificationsProvider>
          ) : (
            <>
              <AppHeader currentPath={currentPath} isLoggedIn={false} />
              {phoneVerificationRequired && userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
              <div style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}>
                {children}
              </div>
              <BottomNav currentPath={pathname} isLoggedIn={false} />
            </>
          )
        ) : (
          <>
            <header className="border-b bg-background/50">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                <Link href="/" className="text-lg font-semibold">
                  Assisto
                </Link>
                <nav className="flex items-center gap-3 text-sm">
                  {userData.user && (
                    <a href="/enquiries" className="relative rounded-full border px-3 py-1">
                      Enquiries
                      <EnquiriesNavBadge />
                    </a>
                  )}
                  <a href="/discover" className="rounded-full border px-3 py-1">
                    Discover
                  </a>
                  <a href="/requirements/new" className="rounded-full border px-3 py-1">
                    Describe need
                  </a>
                  <a href="/apply" className="rounded-full border px-3 py-1">
                    Apply
                  </a>
                  {isProvider && (
                    <a href="/your-work" className="rounded-full border px-3 py-1">
                      Your work
                    </a>
                  )}
                  {profile?.role === "admin" && (
                    <>
                      <a href="/admin/enquiries" className="rounded-full border px-3 py-1">
                        Admin
                      </a>
                      <a href="/admin/reports" className="rounded-full border px-3 py-1">
                        Reports
                      </a>
                      <a href="/admin/chats" className="rounded-full border px-3 py-1">
                        Chats
                      </a>
                      <a href="/admin/bans" className="rounded-full border px-3 py-1">
                        Bans
                      </a>
                    </>
                  )}
                </nav>
                <div>
                  <SessionMenu fullName={profile?.full_name} avatarUrl={profile?.avatar_url} />
                </div>
              </div>
            </header>
            {phoneVerificationRequired && userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
            {children}
            {userData.user && (
              <NotificationsProvider>
                <NotificationBell />
              </NotificationsProvider>
            )}
          </>
        )}
        {userData.user && <BanGate />}
        </PhoneVerificationRequiredProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
