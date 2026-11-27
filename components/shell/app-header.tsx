"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, UserRound } from "lucide-react";
import { useNotifications } from "@/components/notification-bell";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import HomeSearchBar from "@/components/search/home-search-bar";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { createClient } from "@/lib/supabase/client";

type AppHeaderProps = {
  fullName?: string | null;
  isLoggedIn: boolean;
};

export function HeaderSearchSlot({ compact, firstName }: { compact: boolean; firstName?: string | null }) {
  return <HomeSearchBar compact={compact} firstName={firstName} />;
}

export default function AppHeader({ fullName, isLoggedIn }: AppHeaderProps) {
  const pathname = usePathname();
  const hidden = useScrollDirection(64, pathname ?? "/");
  const [hasFocus, setHasFocus] = useState(false);
  const [hasProviderRow, setHasProviderRow] = useState(false);
  const notifications = useNotifications();

  const isHomeRoute = pathname === "/";
  const compact = hidden && !hasFocus;

  useEffect(() => {
    let active = true;
    async function checkProvider() {
      await Promise.resolve();
      if (!isLoggedIn) {
        setHasProviderRow(false);
        return;
      }
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!active || !userData.user) {
        if (active) setHasProviderRow(false);
        return;
      }
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (active) setHasProviderRow(!!provider);
    }
    void checkProvider();
    return () => { active = false; };
  }, [isLoggedIn]);

  return (
    <>
      <header
        className={`sticky top-[env(safe-area-inset-top)] z-30 border-b border-border bg-background/95 backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${compact ? "-translate-y-full" : "translate-y-0"}`}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocus(false);
        }}
        onFocusCapture={() => setHasFocus(true)}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem]">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Assisto
          </Link>

          <div className="flex items-center gap-2">
            {isLoggedIn && hasProviderRow && (
              <Link
                href="/profile/provider"
                aria-label="Provider hub"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <BriefcaseBusiness aria-hidden="true" className="size-5" />
              </Link>
            )}
            {isLoggedIn ? (
              <button
                type="button"
                aria-label="Open notifications"
                onClick={() => notifications?.openPanel("all")}
                className="relative inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Bell aria-hidden="true" className="size-5" />
                {!!notifications?.unreadCount && (
                  <span aria-label={`${notifications.unreadCount} unread notifications`} className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                    {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                  </span>
                )}
              </button>
            ) : (
              <AuthGatedLink href="/discover" actionLabel="to view notifications" onAuthenticated={() => notifications?.openPanel("all")} aria-label="Log in to view notifications" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Bell aria-hidden="true" className="size-5" />
              </AuthGatedLink>
            )}
            <Link
              href={isLoggedIn ? "/profile" : "/login?redirect=%2Fprofile"}
              aria-label="Profile"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <UserRound aria-hidden="true" className="size-5" />
            </Link>
          </div>
        </div>
      </header>
      {isHomeRoute && <HeaderSearchSlot compact={compact} firstName={fullName} />}
    </>
  );
}