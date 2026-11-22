"use client";

import * as React from "react";

type Props = {
  children: React.ReactNode;
  rotated?: boolean;
  onZoomChange?: (zoom: number) => void;
  onSingleTap?: () => void;
  className?: string;
  resetKey?: string;
  externalZoom?: number;
};

export default function MediaZoomSurface({ children, rotated = false, onZoomChange, onSingleTap, className, resetKey, externalZoom }: Props) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const pointersRef = React.useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = React.useRef<{ distance: number; zoom: number; panX: number; panY: number; pointX: number; pointY: number } | null>(null);
  const lastTapRef = React.useRef(0);
  const singleTapTimerRef = React.useRef<number | null>(null);
  const [transform, setTransform] = React.useState({ resetKey, zoom: 1, pan: { x: 0, y: 0 } });
  const stateMatchesKey = transform.resetKey === resetKey;
  const zoom = externalZoom ?? (stateMatchesKey ? transform.zoom : 1);
  const pan = zoom === 1 || !stateMatchesKey ? { x: 0, y: 0 } : transform.pan;

  const clearSingleTap = React.useCallback(() => {
    if (singleTapTimerRef.current !== null) window.clearTimeout(singleTapTimerRef.current);
  }, []);

  React.useEffect(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
  }, [resetKey]);

  React.useEffect(() => () => clearSingleTap(), [clearSingleTap]);

  const clampPan = React.useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const overflowX = Math.max(0, rect.width * (nextZoom - 1) / 2);
    const overflowY = Math.max(0, rect.height * (nextZoom - 1) / 2);
    return {
      x: Math.max(-overflowX, Math.min(overflowX, nextPan.x)),
      y: Math.max(-overflowY, Math.min(overflowY, nextPan.y)),
    };
  }, []);

  function mapPoint(clientX: number, clientY: number) {
    if (!rotated) return { x: clientX, y: clientY };
    // In the 90-degree CSS stage, map screen coordinates back to stage coordinates:
    // stage is rotate(90deg) with transform-origin top-left, then translated into the viewport.
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientY - rect.top, y: rect.right - clientX };
  }

  function applyZoom(nextZoom: number, point?: { x: number; y: number }) {
    const bounded = Math.max(1, Math.min(4, nextZoom));
    const rect = surfaceRef.current?.getBoundingClientRect();
    let nextPan = { x: 0, y: 0 };
    if (bounded > 1 && point && rect) {
      nextPan = { x: -(point.x - rect.left) * (bounded - 1), y: -(point.y - rect.top) * (bounded - 1) };
    }
    const nextTransform = {
      resetKey,
      zoom: bounded,
      pan: clampPan(bounded, nextPan),
    };
    setTransform(nextTransform);
    onZoomChange?.(bounded);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = mapPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 1) {
      gestureRef.current = zoom > 1 ? { distance: 0, zoom, panX: pan.x, panY: pan.y, pointX: point.x, pointY: point.y } : null;
    } else if (pointersRef.current.size === 2) {
      const values = [...pointersRef.current.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      gestureRef.current = { distance, zoom, panX: pan.x, panY: pan.y, pointX: (values[0].x + values[1].x) / 2, pointY: (values[0].y + values[1].y) / 2 };
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = mapPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 2 && gestureRef.current) {
      const values = [...pointersRef.current.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      const nextZoom = Math.max(1, Math.min(4, gestureRef.current.zoom * distance / Math.max(gestureRef.current.distance, 1)));
      setTransform({
        resetKey,
        zoom: nextZoom,
        pan: clampPan(nextZoom, gestureRef.current.panX === 0 ? { x: 0, y: 0 } : { x: gestureRef.current.panX, y: gestureRef.current.panY }),
      });
      onZoomChange?.(nextZoom);
    } else if (pointersRef.current.size === 1 && zoom > 1 && gestureRef.current) {
      const deltaX = point.x - gestureRef.current.pointX;
      const deltaY = point.y - gestureRef.current.pointY;
      setTransform({
        resetKey,
        zoom,
        pan: clampPan(zoom, { x: gestureRef.current.panX + deltaX, y: gestureRef.current.panY + deltaY }),
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) gestureRef.current = null;
  }

  function handleDoubleTap(event: React.PointerEvent<HTMLDivElement>) {
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      clearSingleTap();
      lastTapRef.current = 0;
      if (zoom > 1) applyZoom(1);
      else applyZoom(2.5, mapPoint(event.clientX, event.clientY));
    } else {
      lastTapRef.current = now;
      clearSingleTap();
      singleTapTimerRef.current = window.setTimeout(() => {
        if (zoom === 1) onSingleTap?.();
      }, 250);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    applyZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1), mapPoint(event.clientX, event.clientY));
  }

  function handleKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=") applyZoom(zoom + 0.25);
    else if (event.key === "-") applyZoom(zoom - 0.25);
    else if (event.key === "0") applyZoom(1);
  }

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      role="group"
      aria-label="Zoomable media"
      onPointerDown={(event) => { handlePointerDown(event); handleDoubleTap(event); }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onKeyDown={handleKey}
      className={className}
      style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
    >
      <div className="h-full w-full will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        {children}
      </div>
    </div>
  );
}
