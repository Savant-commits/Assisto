"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { LeafletMapInner, type MapPoint } from "@/components/map/leaflet-map-inner";
import dynamic from "next/dynamic";
import { ShareLocationMenu } from "@/components/map/share-location-menu";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-[100dvh] w-full animate-pulse rounded-none bg-zinc-200" />,
});

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
  const [mapCenter, setMapCenter] = useState(center);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !m-0 !max-w-none !rounded-none !bg-black/50 !p-0">
        <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <DialogClose aria-label="Close map" className="!rounded-full border bg-background" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
