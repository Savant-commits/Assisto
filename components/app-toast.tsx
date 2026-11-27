"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type AppToastProps = {
  children: React.ReactNode;
  role?: "status" | "alert";
  duration?: number;
  position?: "top" | "bottom";
  closeButton?: boolean;
  onDismiss?: () => void;
  className?: string;
};

export function AppToast({
  children,
  role = "status",
  duration,
  position = "bottom",
  closeButton = false,
  onDismiss,
  className,
}: AppToastProps) {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!duration || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      role={role}
      aria-live={role === "status" ? "polite" : "assertive"}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = event.changedTouches[0]?.clientX - touchStartX.current;
        if (typeof delta === "number" && Math.abs(delta) > 60) onDismiss?.();
        touchStartX.current = null;
      }}
      className={cn(
        "fixed left-1/2 z-[80] flex w-[min(calc(100vw-2rem),36rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lifted",
        position === "top" ? "top-[calc(env(safe-area-inset-top)+0.75rem)]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {closeButton && onDismiss && (
        <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden="true" className="size-5" />
        </button>
      )}
    </div>
  );
}
