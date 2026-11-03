"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { MapPoint } from "@/components/map/leaflet-map-inner";
import dynamic from "next/dynamic";
import { ShareLocationMenu } from "@/components/map/share-location-menu";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-[100dvh] w-full animate-pulse rounded-none bg-zinc-200" />,
});

function subscribeToNothing() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function FullscreenMapDialog({
  open,
  onOpenChange,
  center,
  marker,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: MapPoint;
  marker?: MapPoint | null;
  title?: string;
}) {
  const mapCenter = center;
  const mounted = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Location"}
      className="fixed inset-0 z-[1100] h-[100dvh] w-screen overflow-hidden bg-white"
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Close map"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-full border bg-background p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold">{title || "Location"}</h2>
        </div>
        <ShareLocationMenu lat={marker?.lat ?? mapCenter.lat} lng={marker?.lng ?? mapCenter.lng} />
      </div>

      <div className="h-[100dvh] w-full pt-[64px]">
        <MapPreview
          center={center}
          zoom={15}
          marker={marker ?? undefined}
          interactive="full"
          height="100%"
        />
      </div>
    </div>,
    document.body
  );
}
