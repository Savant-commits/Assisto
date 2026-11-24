"use client";

import { ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import type { ProviderPortfolioItem } from "@/lib/types";
import MediaViewerVideo from "@/components/media-viewer-video";
import ZoomPan from "@/components/zoom-pan";

type Props = {
  open: boolean;
  items: ProviderPortfolioItem[];
  providerName: string;
  initialIndex: number;
  trigger: HTMLElement | null;
  onClose: () => void;
};

const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function MediaViewer({ open, items, providerName, initialIndex, trigger, onClose }: Props) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [zoom, setZoom] = React.useState(1);
  const [announcement, setAnnouncement] = React.useState("");
  const mounted = React.useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);
  const activeItem = items[activeIndex];

  React.useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
      scrollerRef.current?.scrollTo({ left: scrollerRef.current.clientWidth * initialIndex, behavior: "auto" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, [open, initialIndex, trigger]);

  const unlockOrientation = React.useCallback(() => {
    try {
      const orientation = typeof screen !== "undefined" ? screen.orientation as ScreenOrientation & { unlock?: () => void } : undefined;
      orientation?.unlock?.();
    } catch {}
  }, []);

  const closeViewer = React.useCallback(async () => {
    unlockOrientation();
    setZoom(1);
    setAnnouncement("Zoom reset");
    await onClose();
    trigger?.focus();
  }, [onClose, trigger, unlockOrientation]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dialogRef.current?.querySelector('[role="menu"]')) return;
        event.preventDefault();
        void closeViewer();
        return;
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && dialogRef.current?.contains(document.activeElement)) {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("input, button, [role='menu']")) return;
        event.preventDefault();
        const next = Math.max(0, Math.min(items.length - 1, activeIndex + (event.key === "ArrowRight" ? 1 : -1)));
        if (next !== activeIndex) {
          unlockOrientation();
          setActiveIndex(next);
          setZoom(1);
          setControlsVisible(true);
          setAnnouncement("Zoom reset");
          scrollerRef.current?.scrollTo({
            left: scrollerRef.current.clientWidth * next,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
        }
        return;
      }
      if (dialogRef.current?.contains(document.activeElement) && !event.defaultPrevented) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          setZoom((value) => Math.min(4, value + 0.25));
        } else if (event.key === "-") {
          event.preventDefault();
          setZoom((value) => Math.max(1, value - 0.25));
        } else if (event.key === "0") {
          event.preventDefault();
          setZoom(1);
        }
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, items.length, open, closeViewer, unlockOrientation]);

  function setActive(next: number) {
    const bounded = Math.max(0, Math.min(items.length - 1, next));
    if (bounded === activeIndex) return;
    unlockOrientation();
    setActiveIndex(bounded);
    setZoom(1);
    setControlsVisible(true);
    setAnnouncement("Zoom reset");
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const next = Math.round(scroller.scrollLeft / scroller.clientWidth);
    if (next !== activeIndex) setActive(next);
  }

  function goTo(index: number) {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActive(next);
    scrollerRef.current?.scrollTo({
      left: scrollerRef.current.clientWidth * next,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    setAnnouncement(nextZoom > 1 ? "Zoomed in" : "Zoom reset");
  }

  if (!mounted || !open || !activeItem) return null;
  const isVideo = activeItem.media_type === "video";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Work by ${providerName}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] h-[100dvh] w-[100dvw] overflow-hidden bg-neutral-950 text-white"
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      {!isVideo && activeItem.image_url && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-neutral-950">
          <img
            src={activeItem.image_url}
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-[40px] brightness-50"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`scrollbar-none absolute inset-0 z-10 flex overflow-x-auto snap-x snap-mandatory ${zoom > 1 ? "overflow-y-hidden" : ""}`}
        style={zoom > 1 ? { overflowX: "hidden", scrollSnapType: "none" } : undefined}
      >
        {items.map((item, index) => (
          <section key={item.id} className="relative h-[100dvh] w-[100dvw] shrink-0 snap-center overflow-hidden bg-transparent">
            {item.media_type === "video" ? (
              index === activeIndex ? (
                <MediaViewerVideo
                  key={item.id}
                  item={item}
                  activeIndex={index}
                  itemCount={items.length}
                  onPrevious={() => goTo(index - 1)}
                  onNext={() => goTo(index + 1)}
                  onClose={closeViewer}
                />
              ) : null
            ) : (
              <ZoomPan
                key={`${item.id}-${activeIndex}`}
                resetKey={`${item.id}-${activeIndex}`}
                externalScale={index === activeIndex ? zoom : undefined}
                onScaleChange={index === activeIndex ? handleZoomChange : undefined}
                onSingleTap={index === activeIndex ? () => setControlsVisible((visible) => !visible) : undefined}
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
              >
                <img
                  src={item.image_url ?? undefined}
                  alt={item.description?.trim() || `Work by ${providerName}`}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                />
              </ZoomPan>
            )}
          </section>
        ))}
      </div>

      {!isVideo && (
        <>
          <header className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity motion-reduce:transition-none ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <span className="rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
              {activeIndex + 1} / {items.length}{announcement ? ` · ${announcement}` : ""}
            </span>
            <button type="button" aria-label="Close media viewer" onClick={closeViewer} className="inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <div className={`pointer-events-none absolute inset-y-0 left-2 right-2 z-20 flex items-center justify-between transition-opacity motion-reduce:transition-none ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <button type="button" aria-label="Previous media" disabled={activeIndex === 0 || zoom > 1} onClick={() => goTo(activeIndex - 1)} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft aria-hidden="true" className="size-6" /></button>
            <button type="button" aria-label="Next media" disabled={activeIndex === items.length - 1 || zoom > 1} onClick={() => goTo(activeIndex + 1)} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight aria-hidden="true" className="size-6" /></button>
          </div>
          <footer className={`absolute inset-x-0 bottom-0 z-30 flex min-h-16 items-center gap-3 bg-black/45 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-opacity motion-reduce:transition-none ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <p className="min-w-0 flex-1 text-center text-sm text-white/90">{activeItem.description?.trim() ?? ""}</p>
            {zoom > 1 && <button type="button" aria-label="Reset zoom" onClick={() => handleZoomChange(1)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-black/75 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><RotateCcw aria-hidden="true" className="size-5" /></button>}
          </footer>
        </>
      )}
    </div>,
    document.body,
  );
}
