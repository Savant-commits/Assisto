"use client";

import * as React from "react";

type Point = { x: number; y: number };
type Pan = { x: number; y: number };
type PointerInfo = { x: number; y: number };
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
  className?: string;
};

const ZERO_PAN: Pan = { x: 0, y: 0 };

export default function ZoomPan({ children, resetKey, rotated = false, externalScale, onScaleChange, onSingleTap, className }: Props) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const pointersRef = React.useRef(new Map<number, PointerInfo>());
  const gestureRef = React.useRef<Gesture | null>(null);
  const lastTapRef = React.useRef<{ at: number; x: number; y: number } | null>(null);
  const tapTimerRef = React.useRef<number | null>(null);
  const callbackRef = React.useRef({ onScaleChange, onSingleTap });
  const [transform, setTransform] = React.useState<{ resetKey: string; scale: number; pan: Pan }>({ resetKey, scale: 1, pan: ZERO_PAN });
  const isCurrent = transform.resetKey === resetKey;
  const scale = externalScale ?? (isCurrent ? transform.scale : 1);
  const pan = scale === 1 || !isCurrent ? ZERO_PAN : transform.pan;
  const scaleRef = React.useRef(1);
  const panRef = React.useRef<Pan>(ZERO_PAN);

  React.useEffect(() => {
    callbackRef.current = { onScaleChange, onSingleTap };
  }, [onScaleChange, onSingleTap]);

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

  const clampPan = React.useCallback((nextScale: number, nextPan: Pan): Pan => {
    const { width, height } = getSize();
    const maxX = width * (nextScale - 1) / 2;
    const maxY = height * (nextScale - 1) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }, [getSize]);

  const updateTransform = React.useCallback((nextScale: number, nextPan: Pan) => {
    const boundedScale = Math.max(1, Math.min(4, nextScale));
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
    // Invert the centered 90-degree stage rotation into its landscape coordinates.
    return { x: clientY - rect.top, y: rect.right - clientX };
  }, [rotated]);

  const zoomAt = React.useCallback((nextScale: number, point?: Point) => {
    const bounded = Math.max(1, Math.min(4, nextScale));
    const current = scaleRef.current;
    const { width, height } = getSize();
    const center = { x: width / 2, y: height / 2 };
    const focus = point ?? center;
    const ratio = bounded / current;
    const nextPan = bounded === 1 ? ZERO_PAN : {
      x: center.x + (panRef.current.x - center.x - focus.x) * ratio + focus.x,
      y: center.y + (panRef.current.y - center.y - focus.y) * ratio + focus.y,
    };
    updateTransform(bounded, nextPan);
  }, [getSize, updateTransform]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const point = mapPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    if (pointersRef.current.size === 1) {
      const capture = scaleRef.current > 1;
      if (capture) {
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      }
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
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
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
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (pointersRef.current.size === 2 && gesture.kind === "pinch") {
      const [first, second] = [...pointersRef.current.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const nextScale = Math.max(1, Math.min(4, gesture.scale * distance / (gesture.distance ?? 1)));
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
        const deltaX = point.x - gesture.start.x;
        const deltaY = point.y - gesture.start.y;
        updateTransform(gesture.scale, { x: gesture.pan.x + deltaX, y: gesture.pan.y + deltaY });
      }
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const point = mapPoint(event.clientX, event.clientY);
    if (pointersRef.current.size === 1 && gesture && !gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 10) {
      const now = Date.now();
      const prior = lastTapRef.current;
      if (prior && now - prior.at < 280 && Math.hypot(event.clientX - prior.x, event.clientY - prior.y) < 36) {
        if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
        lastTapRef.current = null;
        if (scaleRef.current > 1) zoomAt(1);
        else zoomAt(2.5, point);
      } else {
        lastTapRef.current = { at: now, x: event.clientX, y: event.clientY };
        if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = window.setTimeout(() => {
          callbackRef.current.onSingleTap?.();
          tapTimerRef.current = null;
          lastTapRef.current = null;
        }, 280);
      }
    }
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) gestureRef.current = null;
    else if (pointersRef.current.size === 1) {
      const pointLeft = [...pointersRef.current.values()][0];
      gestureRef.current = {
        kind: "pan",
        scale: scaleRef.current,
        pan: panRef.current,
        start: pointLeft,
        clientStart: { x: event.clientX, y: event.clientY },
        moved: true,
      };
    }
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomAt(scaleRef.current * (event.deltaY > 0 ? 0.9 : 1.1), mapPoint(event.clientX, event.clientY));
  }

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
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
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
