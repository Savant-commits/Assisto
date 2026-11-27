"use client";

import { usePathname } from "next/navigation";
import AppHeader from "@/components/shell/app-header";
import BottomNav from "@/components/shell/bottom-nav";
import { NotificationsProvider } from "@/components/notification-bell";

export function RouteChrome({
  children,
  fullName,
  isLoggedIn,
}: {
  children: React.ReactNode;
  fullName?: string | null;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname() || "/";
  const isHomeRoute = pathname === "/";
  const isMessageConversation = pathname.startsWith("/messages/");

  return (
    <NotificationsProvider>
      {isHomeRoute && <AppHeader fullName={fullName} isLoggedIn={isLoggedIn} />}
      <div style={isMessageConversation ? undefined : { paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}>
        {children}
      </div>
      {!isMessageConversation && <BottomNav currentPath={pathname} />}
    </NotificationsProvider>
  );
}
