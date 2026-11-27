"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const PULL_THRESHOLD = 72;
const RESISTANCE = 0.55;
const REFRESH_COOLDOWN_MS = 2000;
const INDICATOR_SETTLE_MS = 550;

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && element.getClientRects().length > 0;
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
  return Array.from(document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"], [aria-expanded="true"], [data-pull-refresh-block="open"], [class*="fixed"][class*="inset-0"]'
  )).some(isVisible);
}

function isBlockedTarget(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']")) return true;
  if (target.closest("input, textarea, select, [contenteditable='true'], .leaflet-container, [role='dialog'], [aria-modal='true'], [role='menu'], [role='listbox'], [aria-expanded='true'], [data-pull-refresh-block='open']")) return true;
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
  const settleTimer = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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
      if (!window.matchMedia("(pointer: coarse)").matches || event.touches.length !== 1 || window.scrollY > 1 || isBlockedTarget(event.target, root)) {
        touchStart.current = null;
        return;
      }
      if (Date.now() - lastRefreshAt.current < REFRESH_COOLDOWN_MS || refreshing) {
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
      if (window.scrollY > 1 || isBlockedByOverlay()) {
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

    const finishGesture = () => {
      const shouldRefresh = rawPullRef.current >= PULL_THRESHOLD && Date.now() - lastRefreshAt.current >= REFRESH_COOLDOWN_MS;
      touchStart.current = null;
      pullDistanceRef.current = 0;
      rawPullRef.current = 0;
      setPullDistance(0);
      if (!shouldRefresh || refreshing) return;

      lastRefreshAt.current = Date.now();
      setRefreshing(true);
      window.dispatchEvent(new Event("app:pull-refresh"));
      router.refresh();
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setRefreshing(false), INDICATOR_SETTLE_MS);
    };

    const cancelGesture = () => {
      touchStart.current = null;
      pullDistanceRef.current = 0;
      rawPullRef.current = 0;
      setPullDistance(0);
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
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    };
  }, [pathname, refreshing, router]);

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
