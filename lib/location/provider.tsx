"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCATION, isSelectedLocation, LOCATION_COOKIE_NAME, RECENT_LOCATIONS_KEY } from "@/lib/location/default";
import type { SelectedLocation } from "@/lib/location/types";

type LocationContextValue = {
  location: SelectedLocation;
  recentLocations: SelectedLocation[];
  setLocation: (location: SelectedLocation) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

function readRecentLocations(): SelectedLocation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_LOCATIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isSelectedLocation).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function matchesLocation(left: SelectedLocation, right: SelectedLocation) {
  return left.city === right.city && left.locality === right.locality &&
    left.lat === right.lat && left.lng === right.lng;
}

export function LocationProvider({
  children,
  initialLocation = DEFAULT_LOCATION,
}: {
  children: React.ReactNode;
  initialLocation?: SelectedLocation;
}) {
  const router = useRouter();
  const [location, setLocationState] = useState(initialLocation);
  const [recentLocations, setRecentLocations] = useState<SelectedLocation[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recent = readRecentLocations();
      setRecentLocations(recent);
      const enrichedInitialLocation = recent.find((item) => matchesLocation(item, initialLocation) && item.formattedLabel);
      if (enrichedInitialLocation) setLocationState(enrichedInitialLocation);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLocation]);

  const setLocation = useCallback((nextLocation: SelectedLocation) => {
    const safeLocation = { ...nextLocation };
    if (safeLocation.source === "device" && safeLocation.lat !== null && safeLocation.lng !== null) {
      safeLocation.lat = Math.round(safeLocation.lat * 1000) / 1000;
      safeLocation.lng = Math.round(safeLocation.lng * 1000) / 1000;
    }

    const cookieLocation = {
      ...safeLocation,
      label: safeLocation.locality || safeLocation.city || safeLocation.label,
    };
    delete cookieLocation.formattedLabel;
    delete cookieLocation.street;
    delete cookieLocation.houseNumber;
    delete cookieLocation.neighbourhood;
    delete cookieLocation.suburb;
    delete cookieLocation.district;
    delete cookieLocation.landmark;
    delete cookieLocation.name;

    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${LOCATION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(cookieLocation))}; Expires=${expires}; Path=/; SameSite=Lax`;
    setLocationState(safeLocation);

    setRecentLocations((current) => {
      const next = [safeLocation, ...current.filter((item) => item.label !== safeLocation.label)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
      } catch {
        // Recent locations are best-effort when browser storage is unavailable.
      }
      return next;
    });

    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ location, recentLocations, setLocation }), [location, recentLocations, setLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within LocationProvider");
  return context;
}
