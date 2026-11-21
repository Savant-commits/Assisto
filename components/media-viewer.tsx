"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import type { ProviderPortfolioItem } from "@/lib/types";

type Props = {
  open: boolean;
  items: ProviderPortfolioItem[];
  providerName: string;
  initialIndex: number;
  trigger: HTMLElement | null;
  onClose: () => void;
};

export default function MediaViewer({ open, items, providerName, initialIndex, trigger, onClose }: Props) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      scrollerRef.current?.scrollTo({ left: scrollerRef.current.clientWidth * initialIndex, behavior: "auto" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => trigger?.focus(), 0);
    };
  }, [open, initialIndex, trigger]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!open) {
      video?.pause();
      return;
    }
    if (video) {
      void video.play().catch(() => {});
    }
    return () => {
      video?.pause();
    };
  }, [open, activeIndex]);

  React.useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function goTo(index: number) {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActiveIndex(next);
    scrollerRef.current?.scrollTo({
      left: scrollerRef.current.clientWidth * next,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const next = Math.round(scroller.scrollLeft / scroller.clientWidth);
    if (next !== activeIndex) setActiveIndex(next);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Work by ${providerName}`}
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-foreground text-background"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <span className="text-sm font-medium" aria-live="polite">
          {activeIndex + 1} / {items.length}
        </span>
        <button
          type="button"
          aria-label="Close media viewer"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center rounded-full text-background hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {items.map((item, index) => (
          <div key={item.id} className="flex h-full w-full shrink-0 snap-center flex-col items-center justify-center px-3 pb-[calc(var(--bottom-nav-height)+1rem+env(safe-area-inset-bottom))]">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {item.media_type === "video" && index === activeIndex ? (
                <video
                  ref={videoRef}
                  src={item.image_url ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-full max-w-full object-contain"
                />
              ) : item.media_type === "video" ? (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-stone text-foreground">Video</div>
              ) : (
                <img
                  src={item.image_url ?? undefined}
                  alt={item.description?.trim() || `Work by ${providerName}`}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>
            {item.description?.trim() && (
              <p className="max-h-16 w-full overflow-y-auto text-center text-sm text-background/80">{item.description.trim()}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] shrink-0 items-center justify-between px-3">
        <button
          type="button"
          aria-label="Previous media"
          disabled={activeIndex === 0}
          onClick={() => goTo(activeIndex - 1)}
          className="inline-flex size-11 items-center justify-center rounded-full text-background disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </button>
        <button
          type="button"
          aria-label="Next media"
          disabled={activeIndex === items.length - 1}
          onClick={() => goTo(activeIndex + 1)}
          className="inline-flex size-11 items-center justify-center rounded-full text-background disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
        >
          <ChevronRight aria-hidden="true" className="size-6" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
