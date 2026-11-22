"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, MoreVertical, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { ProviderPortfolioItem } from "@/lib/types";
import ZoomPan from "@/components/zoom-pan";

type Props = {
  item: ProviderPortfolioItem;
  activeIndex: number;
  itemCount: number;
  zoom: number;
  onZoomChange: (scale: number) => void;
  requestFullscreen: () => Promise<boolean>;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
};

type Orientation = ScreenOrientation & {
  lock?: (orientation: "portrait" | "landscape") => Promise<void>;
  unlock?: () => void;
};

const subscribePortrait = (callback: () => void) => {
  const query = window.matchMedia("(orientation: portrait)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getPortraitSnapshot = () => window.matchMedia("(orientation: portrait)").matches;
const getPortraitServerSnapshot = () => true;

export default function MediaViewerVideo({ item, activeIndex, itemCount, zoom, onZoomChange, requestFullscreen, onPrevious, onNext, onClose }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [interaction, setInteraction] = React.useState(0);
  const [landscapeView, setLandscapeView] = React.useState(false);
  const [cssFallback, setCssFallback] = React.useState(false);
  const [canPip, setCanPip] = React.useState(false);
  const [hasBackdropFrame, setHasBackdropFrame] = React.useState(false);
  const portraitViewport = React.useSyncExternalStore(subscribePortrait, getPortraitSnapshot, getPortraitServerSnapshot);
  const controlsShown = controlsVisible || !playing || menuOpen;
  const cssRotated = landscapeView && cssFallback && portraitViewport;
  const stageStyle: React.CSSProperties = cssRotated
    ? {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "100dvh",
        height: "100dvw",
        transform: "translate(-50%, -50%) rotate(90deg)",
        transformOrigin: "center center",
      }
    : { position: "absolute", inset: 0 };

  const drawBackdrop = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;
    try {
      canvas.width = 48;
      canvas.height = Math.max(1, Math.round(48 * video.videoHeight / video.videoWidth));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setHasBackdropFrame(true);
    } catch {
      setHasBackdropFrame(false);
    }
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const draw = () => drawBackdrop();
    video.addEventListener("loadeddata", draw);
    video.addEventListener("seeked", draw);
    video.addEventListener("resize", draw);
    draw();
    return () => {
      video.removeEventListener("loadeddata", draw);
      video.removeEventListener("seeked", draw);
      video.removeEventListener("resize", draw);
    };
  }, [drawBackdrop, item.id]);

  React.useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(drawBackdrop, 450);
    return () => window.clearInterval(interval);
  }, [drawBackdrop, playing]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try { void video.play().catch(() => {}); } catch {}
    return () => video.pause();
  }, [item.id, item.image_url]);

  React.useEffect(() => {
    if (!playing || menuOpen || !controlsVisible) return;
    const timer = window.setTimeout(() => setControlsVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [playing, menuOpen, controlsVisible, interaction]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const showControls = React.useCallback(() => {
    setControlsVisible(true);
    setInteraction((value) => value + 1);
  }, []);

  const togglePlay = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try { await video.play(); } catch {}
    } else {
      video.pause();
    }
    showControls();
  }, [showControls]);

  React.useEffect(() => {
    const handleSpace = (event: KeyboardEvent) => {
      const dialog = videoRef.current?.closest('[role="dialog"]');
      if (event.code !== "Space" || !dialog?.contains(document.activeElement)) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, input, [role='menu']")) return;
      event.preventDefault();
      void togglePlay();
    };
    document.addEventListener("keydown", handleSpace);
    return () => document.removeEventListener("keydown", handleSpace);
  }, [togglePlay]);

  async function rotateView() {
    const toLandscape = !landscapeView;
    try { await requestFullscreen(); } catch {}
    let locked = false;
    try {
      const orientation = typeof screen !== "undefined" ? screen.orientation as Orientation : undefined;
      if (orientation && typeof orientation.lock === "function") {
        await orientation.lock(toLandscape ? "landscape" : "portrait");
        locked = true;
      } else if (!toLandscape && typeof orientation?.unlock === "function") {
        orientation.unlock();
        locked = true;
      }
    } catch {
      locked = false;
    }
    if (!toLandscape) {
      try {
        const orientation = typeof screen !== "undefined" ? screen.orientation as Orientation : undefined;
        orientation?.unlock?.();
      } catch {}
    }
    setLandscapeView(toLandscape);
    setCssFallback(toLandscape && !locked);
    onZoomChange(1);
    setMenuOpen(false);
    showControls();
  }

  async function enterPip() {
    const video = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!video || typeof video.requestPictureInPicture !== "function") return;
    try { await video.requestPictureInPicture(); } catch {}
    setMenuOpen(false);
    showControls();
  }

  function formatTime(value: number) {
    if (!Number.isFinite(value)) return "0:00";
    return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
  }

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-neutral-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-neutral-900">
        <canvas
          ref={canvasRef}
          width={48}
          height={27}
          className={`absolute inset-0 h-full w-full scale-125 object-cover blur-[40px] brightness-50 transition-opacity duration-300 motion-reduce:transition-none ${hasBackdropFrame ? "opacity-100" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div
        className="absolute z-10 overflow-hidden bg-transparent"
        style={stageStyle}
      >
        <ZoomPan
          resetKey={`${item.id}-${landscapeView}`}
          rotated={cssRotated}
          externalScale={zoom}
          onScaleChange={onZoomChange}
          onSingleTap={() => { void togglePlay(); }}
          className="absolute inset-0 overflow-hidden"
        >
          <video
            ref={videoRef}
            src={item.image_url ?? undefined}
            playsInline
            preload="metadata"
            className="h-full w-full bg-transparent object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => { setPlaying(false); setControlsVisible(true); }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration);
              const video = event.currentTarget as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> };
              setCanPip(Boolean(document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function"));
            }}
          />
        </ZoomPan>
      </div>

      <header className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity motion-reduce:transition-none ${controlsShown ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <span className="rounded-full bg-black/75 px-3 py-1 text-xs text-white" aria-live="polite">{activeIndex + 1} / {itemCount}{zoom > 1 ? " · Zoomed in" : ""}</span>
        <button type="button" aria-label="Close media viewer" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-full bg-black/75 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X aria-hidden="true" className="size-5" /></button>
      </header>

      <div className={`pointer-events-none absolute inset-y-0 left-2 right-2 z-30 flex items-center justify-between transition-opacity motion-reduce:transition-none ${controlsShown ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" aria-label="Previous media" onClick={onPrevious} disabled={activeIndex === 0 || zoom > 1} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/75 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft aria-hidden="true" className="size-6" /></button>
        <button type="button" aria-label="Next media" onClick={onNext} disabled={activeIndex === itemCount - 1 || zoom > 1} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full bg-black/75 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight aria-hidden="true" className="size-6" /></button>
      </div>

      <footer className={`absolute inset-x-0 bottom-0 z-40 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity motion-reduce:transition-none ${controlsShown ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {item.description?.trim() && <p className="mx-auto mb-2 max-w-[90%] rounded-full bg-black/65 px-3 py-1 text-center text-sm text-white/90">{item.description.trim()}</p>}
        <div className="flex items-center gap-1 rounded-xl bg-black/80 px-2 py-1 text-white">
          <button type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlay} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{playing ? <Pause aria-hidden="true" className="size-5" /> : <Play aria-hidden="true" className="size-5 fill-current" />}</button>
          <span className="min-w-[5.5rem] text-xs tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <input type="range" aria-label="Seek video" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`} min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { if (!videoRef.current) return; videoRef.current.currentTime = Number(event.target.value); showControls(); }} className="h-11 min-w-0 flex-1 accent-white" />
          <button type="button" aria-label={muted ? "Unmute video" : "Mute video"} onClick={() => { if (!videoRef.current) return; videoRef.current.muted = !videoRef.current.muted; setMuted(videoRef.current.muted); showControls(); }} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{muted ? <VolumeX aria-hidden="true" className="size-5" /> : <Volume2 aria-hidden="true" className="size-5" />}</button>
          {zoom > 1 && <button type="button" aria-label="Reset zoom" onClick={() => { onZoomChange(1); showControls(); }} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><RotateCcw aria-hidden="true" className="size-5" /></button>}
          <div ref={menuRef} className="relative shrink-0">
            <button type="button" aria-label="Video options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => { setMenuOpen((value) => !value); showControls(); }} className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><MoreVertical aria-hidden="true" className="size-5" /></button>
            {menuOpen && <div role="menu" className="absolute bottom-[calc(100%+0.5rem)] right-0 z-50 w-56 rounded-xl border border-white/15 bg-neutral-950 p-2 text-white shadow-2xl">
              <p className="px-2 py-1 text-xs text-white/65">Playback speed</p>
              {[0.5, 1, 1.25, 1.5, 2].map((value) => <button key={value} type="button" role="menuitem" aria-current={speed === value ? "true" : undefined} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = value; setSpeed(value); setMenuOpen(false); showControls(); }} className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><span>{value}x</span>{speed === value && <span>✓</span>}</button>)}
              {canPip && <button type="button" role="menuitem" onClick={enterPip} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Maximize2 aria-hidden="true" className="size-4" />Picture in picture</button>}
              <button type="button" role="menuitem" onClick={rotateView} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight aria-hidden="true" className="size-4" />{landscapeView ? "Switch to portrait view" : "Switch to landscape view"}</button>
            </div>}
          </div>
        </div>
      </footer>
    </div>
  );
}
