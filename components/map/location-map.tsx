"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ShareLocationMenu } from "@/components/map/share-location-menu";
import { FullscreenMapDialog } from "@/components/map/fullscreen-map-dialog";
import { EXTERNAL_LINK_PROPS } from "@/lib/maps";

const MapPreview = dynamic(() => import("@/components/map/leaflet-map-inner").then((mod) => mod.LeafletMapInner), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-[#f3f4f6] motion-reduce:animate-none" />,
});

export function LocationMap({
  lat,
  lng,
  height = 320,
  interactive = "inline",
  toolbarPosition = "top",
  directionsHref,
}: {
  lat: number;
  lng: number;
  height?: number | string;
  interactive?: "inline" | "static";
  toolbarPosition?: "top" | "bottom";
  directionsHref?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {toolbarPosition === "top" && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">Location</div>
          <MapActions lat={lat} lng={lng} directionsHref={directionsHref} onFullscreen={() => setOpen(true)} />
        </div>
      )}
      <div className="relative" style={{ height }}>
        <MapPreview center={{ lat, lng }} zoom={15} marker={{ lat, lng }} interactive={interactive} height="100%" />
        {interactive === "static" && (
          <button type="button" aria-label="Open location map full screen" onClick={() => setOpen(true)} className="absolute inset-0 z-[400] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <span className="sr-only">Open map full screen</span>
          </button>
        )}
      </div>
      {toolbarPosition === "bottom" && <MapActions lat={lat} lng={lng} directionsHref={directionsHref} onFullscreen={() => setOpen(true)} />}

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

function MapActions({ lat, lng, directionsHref, onFullscreen }: { lat: number; lng: number; directionsHref?: string | null; onFullscreen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onFullscreen} className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Full screen</button>
      <ShareLocationMenu lat={lat} lng={lng} />
      {directionsHref && <a href={directionsHref} {...EXTERNAL_LINK_PROPS} className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-primary underline-offset-4 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Show directions</a>}
    </div>
  );
}
