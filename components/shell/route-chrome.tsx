"use client";

import { usePathname } from "next/navigation";
import AppHeader from "@/components/shell/app-header";
import BottomNav from "@/components/shell/bottom-nav";
import { NotificationsProvider } from "@/components/notification-bell";

const mainTabPaths = new Set(["/", "/discover", "/enquiries", "/profile", "/settings"]);

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
  const showBottomNavigation = mainTabPaths.has(pathname);

  return (
    <NotificationsProvider>
      <AppHeader fullName={fullName} isLoggedIn={isLoggedIn} />
      <div style={showBottomNavigation ? { paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" } : undefined}>
        {children}
      </div>
      {showBottomNavigation && <BottomNav currentPath={pathname} isLoggedIn={isLoggedIn} />}
    </NotificationsProvider>
  );
}
