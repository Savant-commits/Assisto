"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DEFAULT_MAP_CENTER, formatCoords } from "@/lib/maps";
import type { MapPoint } from "@/components/map/leaflet-map-inner";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-[100dvh] w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />,
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

type LocationPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { lat: number; lng: number } | null;
  fallbackCenter?: { lat: number; lng: number };
  title?: string;
  confirmLabel?: string;
  onConfirm: (value: { lat: number; lng: number }) => void;
};

export function LocationPicker({
  ...props
}: LocationPickerProps) {
  const { initial = null, fallbackCenter = DEFAULT_MAP_CENTER } = props;
  const pickerKey = [initial?.lat ?? "", initial?.lng ?? "", fallbackCenter.lat, fallbackCenter.lng].join(":");

  return <LocationPickerContent key={pickerKey} {...props} />;
}

function LocationPickerContent({
  open,
  onOpenChange,
  initial = null,
  fallbackCenter = DEFAULT_MAP_CENTER,
  title = "Choose a location",
  confirmLabel = "Confirm",
  onConfirm,
}: LocationPickerProps) {
  const [center, setCenter] = useState<MapPoint>(initial ?? fallbackCenter);
  const [picked, setPicked] = useState<MapPoint | null>(initial ?? null);
  const [status, setStatus] = useState<string | null>(null);
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

  const handlePick = (lat: number, lng: number) => {
    const next = { lat, lng };
    setPicked(next);
    setCenter(next);
    setStatus(null);
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("Geolocation is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        setPicked(next);
        setCenter(next);
        setStatus("Using your current location.");
      },
      () => {
        setStatus("Location permission was denied. Please pick a point on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1100] h-[100dvh] w-screen overflow-hidden bg-background"
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative flex h-full w-full flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Close location picker"
                onClick={() => onOpenChange(false)}
                className="inline-flex size-11 items-center justify-center rounded-full border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="min-h-11 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Use my current location
            </button>
          </div>

          <div className="relative flex-1">
            <MapPreview
              center={center}
              zoom={15}
              marker={picked}
              onPick={handlePick}
              interactive="full"
              height="100%"
            />
          </div>

          <div className="border-t bg-background px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {picked ? (
                  <p className="text-sm font-medium">Selected: {formatCoords(picked.lat, picked.lng)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Tap or click the map to set the location</p>
                )}
                {status && <p className="text-xs text-muted-foreground">{status}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="min-h-11 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!picked) return;
                    onConfirm(picked);
                    onOpenChange(false);
                  }}
                  disabled={!picked}
                  className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>,
    document.body
  );
}
