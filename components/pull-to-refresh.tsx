"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const PULL_THRESHOLD = 72;
const RESISTANCE = 0.55;
const REFRESH_COOLDOWN_MS = 2000;
const INDICATOR_SETTLE_MS = 550;
const REFRESH_TIMEOUT_MS = 8000;

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && element.getClientRects().length > 0 && !element.closest('[aria-hidden="true"], [inert]');
}

function hasHorizontalScroller(target: Element, boundary: Element): boolean {
  let element: Element | null = target;
  while (element && element !== boundary) {
    const style = window.getComputedStyle(element);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && element.scrollWidth > element.clientWidth + 4) return true;
    element = element.parentElement;
  }
  return false;
}

function isBlockedByOverlay(): boolean {
  const modalSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[aria-modal="true"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[data-pull-refresh-block="open"]',
    '[class*="fixed"][class*="inset-0"]',
  ].join(",");
  if (Array.from(document.querySelectorAll(modalSelectors)).some(isVisible)) return true;

  return Array.from(document.querySelectorAll('[aria-expanded="true"][aria-controls]')).some((trigger) => {
    if (!isVisible(trigger)) return false;
    return (trigger.getAttribute("aria-controls") ?? "").split(/\s+/).some((id) => {
      const controlled = document.getElementById(id);
      return Boolean(controlled && isVisible(controlled));
    });
  });
}

function isBlockedTarget(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']")) return true;
  if (target.closest("input, textarea, select, [contenteditable='true'], .leaflet-container, [role='dialog'], [aria-modal='true'], [role='menu'], [role='listbox'], [data-pull-refresh-block='open']")) return true;
  if (isBlockedByOverlay() || hasHorizontalScroller(target, root)) return true;
  return false;
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pullDistanceRef = useRef(0);
  const rawPullRef = useRef(0);
  const lastRefreshAt = useRef(0);
  const timeoutTimer = useRef<number | null>(null);
  const minimumTimer = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const transitionWaiter = useRef<(() => void) | null>(null);
  const transitionWasPending = useRef(false);
  const cancelActiveCycle = useRef<(() => void) | null>(null);
  const minimumWaiter = useRef<(() => void) | null>(null);
  const previousPathname = useRef(pathname);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  useEffect(() => {
    if (isTransitionPending) {
      transitionWasPending.current = true;
      return;
    }
    if (transitionWasPending.current && transitionWaiter.current) {
      transitionWasPending.current = false;
      transitionWaiter.current();
      transitionWaiter.current = null;
    }
  }, [isTransitionPending]);

  const startRouterRefresh = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      transitionWaiter.current = resolve;
      transitionWasPending.current = false;
      startTransition(() => router.refresh());
    });
  }, [router, startTransition]);

  const resetRefreshState = useCallback(() => {
    refreshingRef.current = false;
    setRefreshing(false);
    setPullDistance(0);
    pullDistanceRef.current = 0;
    rawPullRef.current = 0;
    touchStart.current = null;
    transitionWaiter.current?.();
    transitionWaiter.current = null;
    transitionWasPending.current = false;
    cancelActiveCycle.current?.();
    cancelActiveCycle.current = null;
    minimumWaiter.current?.();
    minimumWaiter.current = null;
    if (timeoutTimer.current !== null) window.clearTimeout(timeoutTimer.current);
    if (minimumTimer.current !== null) window.clearTimeout(minimumTimer.current);
  }, []);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    resetRefreshState();
  }, [pathname, resetRefreshState]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") resetRefreshState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [resetRefreshState]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || pathname.startsWith("/messages/")) return;

    const onTouchStart = (event: TouchEvent) => {
      const pageAtTop = window.scrollY <= 1 || document.documentElement.scrollTop <= 1;
      if (!window.matchMedia("(pointer: coarse)").matches || event.touches.length !== 1 || !pageAtTop || isBlockedTarget(event.target, root)) {
        touchStart.current = null;
        return;
      }
      if (Date.now() - lastRefreshAt.current < REFRESH_COOLDOWN_MS || refreshingRef.current) {
        touchStart.current = null;
        return;
      }
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      rawPullRef.current = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const start = touchStart.current;
      if (!start || event.touches.length !== 1) return;
      if ((window.scrollY > 1 && document.documentElement.scrollTop > 1) || isBlockedByOverlay()) {
        touchStart.current = null;
        pullDistanceRef.current = 0;
        rawPullRef.current = 0;
        setPullDistance(0);
        return;
      }
      const touch = event.touches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
        touchStart.current = null;
        pullDistanceRef.current = 0;
        rawPullRef.current = 0;
        setPullDistance(0);
        return;
      }
      if (deltaY <= 0) {
        pullDistanceRef.current = 0;
        rawPullRef.current = 0;
        setPullDistance(0);
        return;
      }
      if (deltaY > 8) event.preventDefault();
      rawPullRef.current = deltaY;
      const distance = Math.min(104, deltaY * RESISTANCE);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };

    const finishGesture = async () => {
      const shouldRefresh = rawPullRef.current >= PULL_THRESHOLD && Date.now() - lastRefreshAt.current >= REFRESH_COOLDOWN_MS;
      touchStart.current = null;
      pullDistanceRef.current = 0;
      rawPullRef.current = 0;
      setPullDistance(0);
      if (!shouldRefresh || refreshingRef.current) return;

      lastRefreshAt.current = Date.now();
      refreshingRef.current = true;
      setRefreshing(true);
      const startedAt = Date.now();
      try {
        const promises: Promise<unknown>[] = [];
        window.dispatchEvent(new CustomEvent("app:pull-refresh", {
          detail: { register: (promise: Promise<unknown>) => { promises.push(Promise.resolve(promise)); } },
        }));

        if (promises.length === 0) promises.push(startRouterRefresh());

        const reloads = Promise.allSettled(promises);
        const cancelled = new Promise<void>((resolve) => { cancelActiveCycle.current = resolve; });
        const timeout = new Promise<void>((resolve) => {
          timeoutTimer.current = window.setTimeout(resolve, REFRESH_TIMEOUT_MS);
        });
        const minimumVisible = new Promise<void>((resolve) => {
          minimumWaiter.current = resolve;
          minimumTimer.current = window.setTimeout(resolve, Math.max(0, INDICATOR_SETTLE_MS - (Date.now() - startedAt)));
        });
        await Promise.all([Promise.race([reloads, timeout, cancelled]), minimumVisible]);
      } finally {
        if (timeoutTimer.current !== null) window.clearTimeout(timeoutTimer.current);
        if (minimumTimer.current !== null) window.clearTimeout(minimumTimer.current);
        minimumWaiter.current = null;
        cancelActiveCycle.current = null;
        refreshingRef.current = false;
        setRefreshing(false);
      }
    };

    const cancelGesture = () => {
      resetRefreshState();
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", finishGesture, { passive: true });
    root.addEventListener("touchcancel", cancelGesture, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", finishGesture);
      root.removeEventListener("touchcancel", cancelGesture);
    };
  }, [pathname, resetRefreshState, router, startRouterRefresh]);

  useEffect(() => () => {
    refreshingRef.current = false;
    cancelActiveCycle.current?.();
    cancelActiveCycle.current = null;
    minimumWaiter.current?.();
    minimumWaiter.current = null;
    transitionWaiter.current?.();
    transitionWaiter.current = null;
    if (timeoutTimer.current !== null) window.clearTimeout(timeoutTimer.current);
    if (minimumTimer.current !== null) window.clearTimeout(minimumTimer.current);
  }, []);

  const indicatorDistance = reducedMotion ? 0 : pullDistance;
  return (
    <div ref={rootRef} className="min-h-0 flex-1 overscroll-y-contain">
      <div
        aria-live="polite"
        aria-hidden={pullDistance === 0 && !refreshing}
        className={`pointer-events-none fixed inset-x-0 z-[70] flex justify-center ${reducedMotion ? "" : "transition-transform duration-200 motion-reduce:transition-none"}`}
        style={{ top: "env(safe-area-inset-top)", transform: `translateY(${refreshing ? 8 : indicatorDistance - 42}px)`, opacity: pullDistance > 0 || refreshing ? 1 : 0 }}
      >
        <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground shadow-soft">
          <LoaderCircle aria-hidden="true" className={`mr-2 size-4 ${refreshing && !reducedMotion ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : pullDistance >= PULL_THRESHOLD * RESISTANCE ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>
      {children}
    </div>
  );
}
