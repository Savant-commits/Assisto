"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DEFAULT_MAP_CENTER, formatCoords } from "@/lib/maps";
import type { MapPoint } from "@/components/map/leaflet-map-inner";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-[100dvh] w-full animate-pulse bg-zinc-200" />,
});

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

  useEffect(() => {
    if (initial) {
      setPicked(initial);
      setCenter(initial);
      return;
    }
    if (!picked) {
      setCenter(fallbackCenter);
    }
  }, [fallbackCenter, initial, picked]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !m-0 !max-w-none !rounded-none !bg-black/50 !p-0">
        <div className="relative flex h-[100dvh] w-screen flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              <DialogClose aria-label="Close location picker" className="!rounded-full border bg-background" />
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Use my current location
            </button>
          </div>

          <div className="relative flex-1">
            <MapPreview
              center={center}
              zoom={15}
              marker={picked ?? undefined}
              draggableMarker={true}
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
                  <p className="text-sm text-muted-foreground">Tap the map to choose a location.</p>
                )}
                {status && <p className="text-xs text-muted-foreground">{status}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
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
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
