import type { Metadata } from "next";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { GeistSans } from "geist/font/sans";
import { Fraunces } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inspect } from "node:util";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
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
import { AuthSheetProvider } from "@/components/auth/auth-sheet";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assisto — Find the right person for the job",
  description: "Describe what you need and discover approved local professionals in Chidambaram and Cuddalore. You choose who to work with.",
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
  let profileLookupFailed = false;
  let phoneVerificationRequired = true;
  try {
    phoneVerificationRequired = await getPhoneVerificationRequired();
    if (userData.user) {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role, phone_verified_at")
        .eq("id", userData.user.id)
        .single();
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
      profile = data || null;
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
  const isMainTabRoute = ["/", "/discover", "/enquiries", "/profile", "/settings"].includes(pathname);
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
        <AuthSheetProvider initialIsAuthenticated={!!userData.user}>
        <PhoneVerificationRequiredProvider required={phoneVerificationRequired}>
        {isMainTabRoute ? (
          <NotificationsProvider>
            {userData.user ? (
              <>
                <AppHeader
                  currentPath={currentPath}
                  fullName={profile?.full_name}
                  isLoggedIn
                />
                {phoneVerificationRequired && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
                <div style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}>
                  {children}
                </div>
                <BottomNav currentPath={pathname} isLoggedIn />
              </>
            ) : (
            <>
              <AppHeader currentPath={currentPath} isLoggedIn={false} />
              {phoneVerificationRequired && userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
              <div style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}>
                {children}
              </div>
              <BottomNav currentPath={pathname} isLoggedIn={false} />
            </>
            )}
          </NotificationsProvider>
        ) : (
          <>
            <NotificationsProvider>
              <AppHeader currentPath={currentPath} fullName={profile?.full_name} isLoggedIn={!!userData.user} />
            {phoneVerificationRequired && userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
            {children}
            </NotificationsProvider>
          </>
        )}
        {userData.user && <BanGate />}
        </PhoneVerificationRequiredProvider>
        </AuthSheetProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
