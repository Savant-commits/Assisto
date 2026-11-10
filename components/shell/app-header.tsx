"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Compass, House, MessageCircle, UserRound, ClipboardList } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useNotifications } from "@/components/notification-bell";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

type AppHeaderProps = {
  currentPath: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  isLoggedIn: boolean;
};

const tabs = [
  { label: "Home", href: "/", Icon: House },
  { label: "Discover", href: "/discover", Icon: Compass },
  { label: "Requests", href: "/enquiries", Icon: ClipboardList, requiresLogin: true },
  { label: "Messages", href: "/enquiries", Icon: MessageCircle, requiresLogin: true, messages: true },
  { label: "Profile", href: "/profile", Icon: UserRound, requiresLogin: true },
];

export function HeaderSearchSlot() {
  return null;
}

export default function AppHeader({ currentPath, fullName, avatarUrl, isLoggedIn }: AppHeaderProps) {
  const hidden = useScrollDirection();
  const [hasFocus, setHasFocus] = useState(false);
  const notifications = useNotifications();
  const loginHref = `/login?redirect=${encodeURIComponent(currentPath)}`;

  return (
    <header
      className={`sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${hidden && !hasFocus ? "-translate-y-full" : "translate-y-0"}`}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocus(false);
      }}
      onFocusCapture={() => setHasFocus(true)}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem]">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Assisto
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {tabs.map(({ label, href, Icon, requiresLogin, messages }) => {
            const messagesOpen = !!notifications?.isOpen && notifications.activeTab === "messages";
            const active = messages ? messagesOpen : !messagesOpen && currentPath.split("?")[0] === href;
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
              <Link key={label} href={requiresLogin && !isLoggedIn ? loginHref : href} className={className} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

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
            <Link href={loginHref} aria-label="Log in to view notifications" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Bell aria-hidden="true" className="size-5" />
            </Link>
          )}
          <Link
            href={isLoggedIn ? "/profile" : loginHref}
            aria-label={isLoggedIn ? `${fullName || "Your"} profile` : "Log in to view your profile"}
            className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Avatar src={avatarUrl} name={fullName || "Profile"} size={36} className="size-9 rounded-full object-cover" />
          </Link>
        </div>
      </div>
      <HeaderSearchSlot />
    </header>
  );
}