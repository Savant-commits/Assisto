"use client";

import * as React from "react";
import LocationSelector from "@/components/location/location-selector";
import { useLocation } from "@/lib/location/provider";
import { useRouter } from "next/navigation";

function locationKey(location: ReturnType<typeof useLocation>["location"]) {
  return [location.city, location.locality, location.lat, location.lng].join("|");
}

export default function DiscoverLocationChip({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const { location } = useLocation();
  const router = useRouter();
  const previousKeyRef = React.useRef(locationKey(location));

  React.useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if ((variant === "mobile") !== isMobile) return;
    const nextKey = locationKey(location);
    if (previousKeyRef.current === nextKey) return;
    previousKeyRef.current = nextKey;

    const params = new URLSearchParams(window.location.search);
    if (!params.has("city")) {
      router.refresh();
      return;
    }
    params.delete("city");
    const query = params.toString();
    router.replace(`/discover${query ? `?${query}` : ""}`, { scroll: false });
  }, [location, router, variant]);

  return (
    <span className="inline-flex shrink-0 snap-start items-center rounded-full border border-border bg-background/80">
      <LocationSelector />
    </span>
  );
}
