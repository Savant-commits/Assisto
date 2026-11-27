"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const refreshResolver = useRef<(() => void) | null>(null);
  const refreshTransitionStarted = useRef(false);
  const isHomeRoute = pathname === "/";
  const isMessageConversation = pathname.startsWith("/messages/");

  useEffect(() => {
    if (isRefreshPending) {
      refreshTransitionStarted.current = true;
      return;
    }
    if (!isRefreshPending && refreshTransitionStarted.current && refreshResolver.current) {
      refreshTransitionStarted.current = false;
      refreshResolver.current();
      refreshResolver.current = null;
    }
  }, [isRefreshPending]);

  useEffect(() => {
    if (pathname !== "/" && pathname !== "/discover") return;
    const handlePullRefresh = (event: Event) => {
      const register = (event as CustomEvent<{ register?: (promise: Promise<unknown>) => void }>).detail?.register;
      if (!register) return;
      const refreshPromise = new Promise<void>((resolve) => { refreshResolver.current = resolve; });
      register(refreshPromise);
      refreshTransitionStarted.current = false;
      startRefreshTransition(() => router.refresh());
    };
    window.addEventListener("app:pull-refresh", handlePullRefresh);
    return () => {
      window.removeEventListener("app:pull-refresh", handlePullRefresh);
      refreshResolver.current?.();
      refreshResolver.current = null;
      refreshTransitionStarted.current = false;
    };
  }, [pathname, router, startRefreshTransition]);

  useEffect(() => {
    if (pathname === "/" || pathname === "/discover") return;
    refreshResolver.current?.();
    refreshResolver.current = null;
    refreshTransitionStarted.current = false;
  }, [pathname]);

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
