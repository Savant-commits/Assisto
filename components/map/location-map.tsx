"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ShareLocationMenu } from "@/components/map/share-location-menu";
import { FullscreenMapDialog } from "@/components/map/fullscreen-map-dialog";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded-lg bg-zinc-200" />,
});

export function LocationMap({
  lat,
  lng,
  height = 320,
}: {
  lat: number;
  lng: number;
  height?: number | string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">Location</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Full screen
          </button>
          <ShareLocationMenu lat={lat} lng={lng} />
        </div>
      </div>

      <MapPreview center={{ lat, lng }} zoom={15} marker={{ lat, lng }} interactive="inline" height={height} />

      <FullscreenMapDialog
        open={open}
        onOpenChange={setOpen}
        center={{ lat, lng }}
        marker={{ lat, lng }}
        title="Location"
      />
    </div>
  );
}
