"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { ProviderPortfolioItem } from "@/lib/types";

type Props = {
  item: ProviderPortfolioItem;
  activeIndex: number;
  itemCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
};

type OrientationApi = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};
type IosVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DISTANCE = 28;

export default function MediaViewerVideo({ item, activeIndex, itemCount, onPrevious, onNext, onClose }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const tapRef = React.useRef<{ x: number; y: number; at: number } | null>(null);
  const tapTimerRef = React.useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const unlockOrientation = React.useCallback(() => {
    try {
      const orientation = typeof screen !== "undefined" ? screen.orientation as OrientationApi : undefined;
      orientation?.unlock?.();
    } catch {
      // Orientation APIs are optional and browser-dependent.
    }
  }, []);

  const syncFullscreen = React.useCallback(() => {
    const video = videoRef.current as IosVideo | null;
    const fullscreen = Boolean(video && (
      document.fullscreenElement === video ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement === video ||
      (video as IosVideo & { webkitDisplayingFullscreen?: boolean }).webkitDisplayingFullscreen
    ));
    setIsFullscreen(fullscreen);
    if (!fullscreen) {
      unlockOrientation();
      return;
    }
    const isLandscapeVideo = Boolean(video && video.videoWidth > video.videoHeight);
    const isPortraitViewport = window.matchMedia("(orientation: portrait)").matches;
    if (!isLandscapeVideo || !isPortraitViewport) return;
    try {
      const orientation = typeof screen !== "undefined" ? screen.orientation as OrientationApi : undefined;
      if (typeof orientation?.lock === "function") void orientation.lock("landscape").catch(() => {});
    } catch {
      // Orientation lock can be unavailable even after fullscreen is entered.
    }
  }, [unlockOrientation]);

  React.useEffect(() => {
    const video = videoRef.current as IosVideo | null;
    const handleFullscreenStart = () => syncFullscreen();
    const handleFullscreenEnd = () => {
      setIsFullscreen(false);
      unlockOrientation();
    };
    document.addEventListener("fullscreenchange", handleFullscreenStart);
    document.addEventListener("webkitfullscreenchange", handleFullscreenStart);
    video?.addEventListener("webkitbeginfullscreen", handleFullscreenStart);
    video?.addEventListener("webkitendfullscreen", handleFullscreenEnd);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenStart);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenStart);
      video?.removeEventListener("webkitbeginfullscreen", handleFullscreenStart);
      video?.removeEventListener("webkitendfullscreen", handleFullscreenEnd);
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
      video?.pause();
      try {
        if (document.fullscreenElement === video) void document.exitFullscreen().catch(() => {});
      } catch {
        // Fullscreen may already have been exited by the browser.
      }
      unlockOrientation();
    };
  }, [item.id, syncFullscreen, unlockOrientation]);

  async function enterFullscreen() {
    const video = videoRef.current as IosVideo | null;
    if (!video) return;
    try {
      if (typeof video.requestFullscreen === "function") {
        await video.requestFullscreen();
      } else if (typeof video.webkitEnterFullscreen === "function") {
        video.webkitEnterFullscreen();
      }
    } catch {
      // Fullscreen is a progressive enhancement; inline native controls still work.
    }
    syncFullscreen();
  }

  function handleSurfacePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, input")) return;
    const video = videoRef.current;
    if (!video) return;
    const bounds = video.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    // Let the browser-owned native control strip handle taps in its bottom area.
    if (event.clientY >= bounds.bottom - 56) return;
    const previous = tapRef.current;
    const now = Date.now();
    const isDoubleTap = previous !== null && now - previous.at <= DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= DOUBLE_TAP_DISTANCE;
    if (isDoubleTap) {
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      tapRef.current = null;
      event.preventDefault();
      void enterFullscreen();
      return;
    }
    tapRef.current = { x: event.clientX, y: event.clientY, at: now };
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
      }
      tapTimerRef.current = null;
      tapRef.current = null;
    }, DOUBLE_TAP_MS);
  }

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-neutral-950 text-white">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/75 px-3 py-1 text-xs text-white" aria-live="polite">{activeIndex + 1} / {itemCount}</span>
        <button type="button" aria-label="Close media viewer" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-full bg-black/75 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div className="pointer-events-none absolute inset-y-0 left-2 right-2 z-30 flex items-center justify-between">
        <button type="button" aria-label="Previous media" onClick={onPrevious} disabled={activeIndex === 0} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <ChevronLeft aria-hidden="true" className="size-6" />
        </button>
        <button type="button" aria-label="Next media" onClick={onNext} disabled={activeIndex === itemCount - 1} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <ChevronRight aria-hidden="true" className="size-6" />
        </button>
      </div>

      <div
        onPointerUp={handleSurfacePointerUp}
        className="absolute inset-0 flex items-center justify-center px-2 py-16"
        aria-label="Video area. Tap to play or pause; double-tap for fullscreen."
      >
        <video
          ref={videoRef}
          src={item.image_url ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={item.description?.trim() || item.caption?.trim() || `Video ${activeIndex + 1} of ${itemCount}`}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-40 flex items-end justify-center gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {item.description?.trim() && <p className="max-w-[70%] truncate rounded-full bg-black/65 px-3 py-2 text-center text-sm text-white/90">{item.description.trim()}</p>}
        <button type="button" aria-label={isFullscreen ? "Video fullscreen" : "Enter video fullscreen"} onClick={() => void enterFullscreen()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-black/75 px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Maximize2 aria-hidden="true" className="size-4" />
          Fullscreen
        </button>
      </footer>
    </div>
  );
}