"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const REFRESH_INTERVAL = 5 * 60 * 1000;
const PULL_THRESHOLD = 70;

export function HomeRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastRefresh = useRef(0);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshTimer = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    lastRefresh.current = Date.now();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);

    const refreshIfStale = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh.current < REFRESH_INTERVAL) return;
      lastRefresh.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [router]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia("(pointer: coarse)").matches) return;

    const onStart = (event: TouchEvent) => {
      if (window.scrollY === 0 && event.touches.length === 1 && !refreshingRef.current) {
        startY.current = event.touches[0].clientY;
      } else {
        startY.current = null;
      }
    };
    const onMove = (event: TouchEvent) => {
      if (startY.current === null || window.scrollY > 0) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPullDistance(0);
        return;
      }
      event.preventDefault();
      pullRef.current = Math.min(PULL_THRESHOLD, delta * 0.45);
      setPullDistance(pullRef.current);
    };
    const onEnd = () => {
      if (startY.current !== null && pullRef.current >= PULL_THRESHOLD * 0.45) {
        lastRefresh.current = Date.now();
        refreshingRef.current = true;
        setRefreshing(true);
        router.refresh();
        if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
        }, 900);
      }
      startY.current = null;
      pullRef.current = 0;
      setPullDistance(0);
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd, { passive: true });
    root.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, [router]);

  const visibleDistance = reducedMotion ? 0 : pullDistance;
  return (
    <div ref={rootRef} className="overscroll-y-contain">
      <div aria-live="polite" aria-hidden={pullDistance === 0 && !refreshing} className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center transition-opacity motion-reduce:transition-none" style={{ opacity: pullDistance > 0 || refreshing ? 1 : 0 }}>
        <span className="rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-soft">
          {refreshing && <LoaderCircle aria-hidden="true" className="mr-2 inline size-4 motion-safe:animate-spin" />}
          {refreshing ? "Refreshing…" : "Pull to refresh"}
        </span>
      </div>
      <div style={{ transform: visibleDistance ? `translateY(${visibleDistance}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
}
