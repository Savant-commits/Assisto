"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    lastRefreshAt.current = Date.now();
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshAt.current < REFRESH_INTERVAL) return;
      lastRefreshAt.current = Date.now();
      router.refresh();
    };
    const markPullRefresh = () => { lastRefreshAt.current = Date.now(); };
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("app:pull-refresh", markPullRefresh);
    const refreshInterval = window.setInterval(refreshIfStale, REFRESH_INTERVAL);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("app:pull-refresh", markPullRefresh);
      window.clearInterval(refreshInterval);
    };
  }, [router]);

  return <>{children}</>;
}
