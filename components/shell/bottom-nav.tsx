"use client";

import Link from "next/link";
import { useNotifications } from "@/components/notification-bell";
import { Compass, House, MessageCircle, UserRound, ClipboardList } from "lucide-react";

type BottomNavProps = {
  currentPath: string;
  isLoggedIn: boolean;
};

const items = [
  { label: "Home", href: "/", Icon: House },
  { label: "Discover", href: "/discover", Icon: Compass },
  { label: "Requests", href: "/enquiries", Icon: ClipboardList, requiresLogin: true },
  { label: "Messages", href: "/enquiries", Icon: MessageCircle, requiresLogin: true, messages: true },
  { label: "Profile", href: "/profile", Icon: UserRound, requiresLogin: true },
];

export default function BottomNav({ currentPath, isLoggedIn }: BottomNavProps) {
  const notifications = useNotifications();
  const loginHref = (target: string) => `/login?redirect=${encodeURIComponent(target)}`;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background lg:hidden"
      style={{ height: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-full max-w-xl items-stretch justify-around px-1">
        {items.map(({ label, href, Icon, requiresLogin, messages }) => {
          const messagesOpen = notifications?.activeTab === "messages" && notifications.isOpen;
          const active = messages ? messagesOpen : !messagesOpen && currentPath === href;
          const className = `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${active ? "text-primary" : "text-muted-foreground"}`;

          if (messages && isLoggedIn) {
            return (
              <li key={label} className="flex min-w-0 flex-1">
                <button type="button" className={className} onClick={() => notifications?.openPanel("messages")}>
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{label}</span>
                  {!!notifications?.unreadMessageCount && (
                    <span aria-label={`${notifications.unreadMessageCount} unread messages`} className="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white">
                      {notifications.unreadMessageCount > 9 ? "9+" : notifications.unreadMessageCount}
                    </span>
                  )}
                </button>
              </li>
            );
          }

          return (
            <li key={label} className="flex min-w-0 flex-1">
              <Link
                href={requiresLogin && !isLoggedIn ? loginHref(href) : href}
                className={className}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}