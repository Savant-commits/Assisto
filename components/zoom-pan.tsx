"use client";

import * as React from "react";

type Point = { x: number; y: number };
type Pan = { x: number; y: number };
type PointerInfo = Point & { clientX: number; clientY: number };
type Gesture = {
  kind: "tap" | "pan" | "pinch";
  scale: number;
  pan: Pan;
  start: Point;
  clientStart: Point;
  center?: Point;
  distance?: number;
  moved: boolean;
};

type Props = {
  children: React.ReactNode;
  resetKey: string;
  rotated?: boolean;
  externalScale?: number;
  onScaleChange?: (scale: number) => void;
  onSingleTap?: () => void;
  onDoubleTap?: (point: Point) => void;
  className?: string;
};

const ZERO_PAN: Pan = { x: 0, y: 0 };
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 24;

export default function ZoomPan({ children, resetKey, rotated = false, externalScale, onScaleChange, onSingleTap, onDoubleTap, className }: Props) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const pointersRef = React.useRef(new Map<number, PointerInfo>());
  const gestureRef = React.useRef<Gesture | null>(null);
  const lastTapRef = React.useRef<{ at: number; x: number; y: number } | null>(null);
  const tapTimerRef = React.useRef<number | null>(null);
  const callbackRef = React.useRef({ onScaleChange, onSingleTap, onDoubleTap });
  const [transform, setTransform] = React.useState<{ resetKey: string; scale: number; pan: Pan }>({ resetKey, scale: 1, pan: ZERO_PAN });
  const isCurrent = transform.resetKey === resetKey;
  const scale = externalScale ?? (isCurrent ? transform.scale : 1);
  const pan = scale === 1 || !isCurrent ? ZERO_PAN : transform.pan;
  const scaleRef = React.useRef(1);
  const panRef = React.useRef<Pan>(ZERO_PAN);

  React.useEffect(() => {
    callbackRef.current = { onScaleChange, onSingleTap, onDoubleTap };
  }, [onDoubleTap, onScaleChange, onSingleTap]);

  React.useEffect(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = null;
    scaleRef.current = 1;
    panRef.current = ZERO_PAN;
  }, [resetKey]);

  React.useEffect(() => {
    scaleRef.current = scale;
    panRef.current = pan;
  }, [scale, pan]);

  React.useEffect(() => () => {
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    pointersRef.current.clear();
  }, []);

  const getSize = React.useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { width: 0, height: 0 };
    return rotated ? { width: rect.height, height: rect.width } : { width: rect.width, height: rect.height };
  }, [rotated]);

  const getRenderedMediaSize = React.useCallback(() => {
    const { width, height } = getSize();
    const media = surfaceRef.current?.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    const intrinsicWidth = media instanceof HTMLVideoElement ? media.videoWidth : media?.naturalWidth;
    const intrinsicHeight = media instanceof HTMLVideoElement ? media.videoHeight : media?.naturalHeight;
    if (!width || !height || !intrinsicWidth || !intrinsicHeight) return { width, height };
    const fit = Math.min(width / intrinsicWidth, height / intrinsicHeight);
    return { width: intrinsicWidth * fit, height: intrinsicHeight * fit };
  }, [getSize]);

  const clampPan = React.useCallback((nextScale: number, nextPan: Pan): Pan => {
    const viewport = getSize();
    const media = getRenderedMediaSize();
    const maxX = Math.max(0, (media.width * nextScale - viewport.width) / 2);
    const maxY = Math.max(0, (media.height * nextScale - viewport.height) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }, [getRenderedMediaSize, getSize]);

  const updateTransform = React.useCallback((nextScale: number, nextPan: Pan) => {
    const boundedScale = Math.max(1, Math.min(MAX_SCALE, nextScale));
    const boundedPan = boundedScale === 1 ? ZERO_PAN : clampPan(boundedScale, nextPan);
    scaleRef.current = boundedScale;
    panRef.current = boundedPan;
    setTransform({ resetKey, scale: boundedScale, pan: boundedPan });
    callbackRef.current.onScaleChange?.(boundedScale);
  }, [clampPan, resetKey]);

  const mapPoint = React.useCallback((clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    if (!rotated) return { x: clientX - rect.left, y: clientY - rect.top };
    // Undo the centered 90-degree rotation: stage dx=screen dy, stage dy=-screen dx.
    return { x: clientY - rect.top, y: rect.right - clientX };
  }, [rotated]);

  const zoomAt = React.useCallback((nextScale: number, point?: Point) => {
    const bounded = Math.max(1, Math.min(MAX_SCALE, nextScale));
    const current = scaleRef.current;
    const { width, height } = getSize();
    const center = { x: width / 2, y: height / 2 };
    const focus = point ?? center;
    const ratio = bounded / current;
    // With transform-origin:center, preserve the content point under focus:
    // t1 = (focus-center) * (1-ratio) + t0 * ratio.
    const nextPan = bounded === 1 ? ZERO_PAN : {
      x: (focus.x - center.x) * (1 - ratio) + panRef.current.x * ratio,
      y: (focus.y - center.y) * (1 - ratio) + panRef.current.y * ratio,
    };
    updateTransform(bounded, nextPan);
  }, [getSize, updateTransform]);

  React.useEffect(() => {
    const surface = surfaceRef.current;
    const media = surface?.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    if (!surface) return;
    const reclamp = () => {
      if (scaleRef.current > 1) updateTransform(scaleRef.current, panRef.current);
    };
    media?.addEventListener("load", reclamp);
    media?.addEventListener("loadedmetadata", reclamp);
    media?.addEventListener("resize", reclamp);
    let observer: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(reclamp);
        observer.observe(surface);
        if (media) observer.observe(media);
      }
    } catch {
      observer?.disconnect();
      observer = null;
    }
    return () => {
      media?.removeEventListener("load", reclamp);
      media?.removeEventListener("loadedmetadata", reclamp);
      media?.removeEventListener("resize", reclamp);
      observer?.disconnect();
    };
  }, [updateTransform, resetKey]);

  const capturePointer = React.useCallback((element: HTMLDivElement, pointerId: number) => {
    try { element.setPointerCapture(pointerId); } catch {}
  }, []);

  const releasePointer = React.useCallback((element: HTMLDivElement, pointerId: number) => {
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch {}
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = mapPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, { ...point, clientX: event.clientX, clientY: event.clientY });
    if (pointersRef.current.size === 1) {
      const capture = scaleRef.current > 1;
      if (capture) capturePointer(event.currentTarget, event.pointerId);
      gestureRef.current = {
        kind: capture ? "pan" : "tap",
        scale: scaleRef.current,
        pan: panRef.current,
        start: point,
        clientStart: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      return;
    }
    if (pointersRef.current.size === 2) {
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapRef.current = null;
      for (const pointerId of pointersRef.current.keys()) capturePointer(event.currentTarget, pointerId);
      const [first, second] = [...pointersRef.current.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      gestureRef.current = {
        kind: "pinch",
        scale: scaleRef.current,
        pan: panRef.current,
        start: center,
        clientStart: { x: event.clientX, y: event.clientY },
        center,
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        moved: true,
      };
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = mapPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, { ...point, clientX: event.clientX, clientY: event.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (pointersRef.current.size === 2 && gesture.kind === "pinch") {
      const [first, second] = [...pointersRef.current.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const nextScale = Math.max(1, Math.min(MAX_SCALE, gesture.scale * distance / (gesture.distance ?? 1)));
      const origin = { x: getSize().width / 2, y: getSize().height / 2 };
      const contentPoint = {
        x: origin.x + (gesture.center!.x - origin.x - gesture.pan.x) / gesture.scale,
        y: origin.y + (gesture.center!.y - origin.y - gesture.pan.y) / gesture.scale,
      };
      updateTransform(nextScale, {
        x: center.x - origin.x - (contentPoint.x - origin.x) * nextScale,
        y: center.y - origin.y - (contentPoint.y - origin.y) * nextScale,
      });
    } else if (pointersRef.current.size === 1) {
      const dxClient = event.clientX - gesture.clientStart.x;
      const dyClient = event.clientY - gesture.clientStart.y;
      if (Math.hypot(dxClient, dyClient) > 8) gesture.moved = true;
      if (gesture.kind === "pan" && gesture.scale > 1) {
        // mapPoint swaps the axes and negates screen dx for a clockwise CSS rotation.
        updateTransform(gesture.scale, {
          x: gesture.pan.x + point.x - gesture.start.x,
          y: gesture.pan.y + point.y - gesture.start.y,
        });
      }
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const point = mapPoint(event.clientX, event.clientY);
    const singlePointer = pointersRef.current.size === 1;
    if (singlePointer && gesture && gesture.kind !== "pinch" && !gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 10) {
      const now = Date.now();
      const prior = lastTapRef.current;
      if (prior && now - prior.at <= DOUBLE_TAP_MS && Math.hypot(event.clientX - prior.x, event.clientY - prior.y) < DOUBLE_TAP_DISTANCE) {
        if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
        lastTapRef.current = null;
        if (callbackRef.current.onDoubleTap) callbackRef.current.onDoubleTap(point);
        else if (scaleRef.current > 1) zoomAt(1);
        else zoomAt(2, point);
      } else {
        lastTapRef.current = { at: now, x: event.clientX, y: event.clientY };
        if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = window.setTimeout(() => {
          callbackRef.current.onSingleTap?.();
          tapTimerRef.current = null;
          lastTapRef.current = null;
        }, DOUBLE_TAP_MS);
      }
    }

    pointersRef.current.delete(event.pointerId);
    releasePointer(event.currentTarget, event.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    } else if (pointersRef.current.size === 1) {
      const [pointerId, remaining] = [...pointersRef.current.entries()][0];
      gestureRef.current = {
        kind: "pan",
        scale: scaleRef.current,
        pan: panRef.current,
        start: { x: remaining.x, y: remaining.y },
        clientStart: { x: remaining.clientX, y: remaining.clientY },
        moved: true,
      };
      if (scaleRef.current > 1) capturePointer(event.currentTarget, pointerId);
    }
  }

  function cancelPointers(event: React.PointerEvent<HTMLDivElement>) {
    for (const pointerId of pointersRef.current.keys()) releasePointer(event.currentTarget, pointerId);
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = null;
  }

  function handleLostPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    for (const pointerId of pointersRef.current.keys()) {
      if (pointerId !== event.pointerId) releasePointer(event.currentTarget, pointerId);
    }
    pointersRef.current.clear();
    gestureRef.current = null;
    lastTapRef.current = null;
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = null;
  }

  const handleWheel = React.useCallback((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    if (event.cancelable) event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(scaleRef.current * factor, mapPoint(event.clientX, event.clientY));
  }, [mapPoint, zoomAt]);

  React.useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=") zoomAt(scaleRef.current + 0.25);
    else if (event.key === "-") zoomAt(scaleRef.current - 0.25);
    else if (event.key === "0") zoomAt(1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      role="group"
      aria-label="Zoomable media"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelPointers}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ touchAction: scale > 1 ? "none" : "pan-x" }}
    >
      <div
        className="h-full w-full will-change-transform transition-transform duration-75 motion-reduce:transition-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
