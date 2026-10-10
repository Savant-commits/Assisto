import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import SessionMenu from "@/components/session-menu";
import { EnquiriesNavBadge } from "@/components/enquiries-nav-badge";
import NotificationBell from "@/components/notification-bell";
import BanGate from "@/components/ban-gate";
import { PhoneVerifyBanner } from "@/components/phone-verify-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Assisto — Find the right person for the job",
  description: "Describe what you need and discover approved local professionals in Cuddalore and Chidambaram. You choose who to work with.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("layout auth lookup failed", {
      message: userError.message,
      details: "details" in userError ? userError.details : undefined,
      hint: "hint" in userError ? userError.hint : undefined,
      code: userError.code,
    });
  }
  let profile: { full_name?: string; avatar_url?: string | null; role?: string | null; phone_verified_at?: string | null } | null = null;
  let isProvider = false;
  if (userData.user) {
    const [{ data, error: profileError }, { data: provider, error: providerError }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, role, phone_verified_at").eq("id", userData.user.id).single(),
      supabase.from("providers").select("id").eq("id", userData.user.id).maybeSingle(),
    ]);
    if (profileError) {
      console.error("layout profile lookup failed", {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
        {userData.user && profile?.role !== "admin" && !profile?.phone_verified_at && <PhoneVerifyBanner />}
        {children}
        {userData.user && <NotificationBell />}
        {userData.user && <BanGate />}
      </body>
    </html>
  );
}
