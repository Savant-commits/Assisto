"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, House, LogIn, MessageCircle, Settings as SettingsIcon, UserRound, ClipboardList } from "lucide-react";
import { useNotifications } from "@/components/notification-bell";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import HomeSearchBar from "@/components/search/home-search-bar";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { useAuthGate } from "@/components/auth/auth-sheet";

type AppHeaderProps = {
  fullName?: string | null;
  isLoggedIn: boolean;
};

const tabs = [
  { label: "Home", href: "/", Icon: House },
  { label: "Discover", href: "/discover", Icon: Compass },
  { label: "Requests", href: "/enquiries", Icon: ClipboardList, requiresLogin: true },
  { label: "Messages", href: "/enquiries", Icon: MessageCircle, requiresLogin: true, messages: true },
  { label: "Profile", href: "/profile", Icon: UserRound, requiresLogin: true },
];

export function HeaderSearchSlot({ compact, firstName }: { compact: boolean; firstName?: string | null }) {
  return <HomeSearchBar compact={compact} firstName={firstName} />;
}

export default function AppHeader({ fullName, isLoggedIn }: AppHeaderProps) {
  const pathname = usePathname();
  const hidden = useScrollDirection(64, pathname ?? "/");
  const [hasFocus, setHasFocus] = useState(false);
  const notifications = useNotifications();
  const { requireAuth } = useAuthGate();

  const isHomeRoute = pathname === "/";
  const isSettingsRoute = pathname === "/settings";
  const compact = hidden && !hasFocus;

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

          {isHomeRoute && <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {tabs.map(({ label, href, Icon, requiresLogin, messages }) => {
              const messagesOpen = !!notifications?.isOpen && notifications.activeTab === "messages";
              const active = messages ? messagesOpen : !messagesOpen && pathname === href;
              const className = `inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

              if (messages && isLoggedIn) {
                return (
                  <button key={label} type="button" className={className} aria-current={active ? "page" : undefined} onClick={() => notifications?.openPanel("messages")}>
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </button>
                );
              }

              return (
                requiresLogin ? (
                  <AuthGatedLink
                    key={label}
                    href={href}
                    actionLabel={`to view ${label.toLowerCase()}`}
                    onAuthenticated={messages ? () => notifications?.openPanel("messages") : undefined}
                    className={className}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </AuthGatedLink>
                ) : (
                  <Link key={label} href={href} className={className} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </Link>
                )
              );
            })}
          </nav>}

          <div className="flex items-center gap-2">
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
              href="/settings"
              aria-label="Settings"
              aria-current={isSettingsRoute ? "page" : undefined}
              className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isSettingsRoute ? "bg-accent text-primary" : "text-foreground hover:bg-muted"}`}
            >
              <SettingsIcon aria-hidden="true" className="size-5" />
            </Link>
            {!isLoggedIn && (
              <button
                type="button"
                aria-label="Sign in"
                onClick={() => requireAuth(() => {}, "to access your account")}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-[380px]:size-11 max-[380px]:px-0"
              >
                <LogIn aria-hidden="true" className="size-4" />
                <span className="max-[380px]:sr-only">Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>
      {isHomeRoute && <HeaderSearchSlot compact={compact} firstName={fullName} />}
    </>
  );
}