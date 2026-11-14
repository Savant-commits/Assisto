"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_LOCATION } from "@/lib/location/default";
import { useLocation } from "@/lib/location/provider";
import type { GeocodedLocation, SelectedLocation } from "@/lib/location/types";

const LocationPicker = dynamic(
  () => import("@/components/map/location-picker").then((module) => module.LocationPicker),
  { ssr: false },
);

function selectedFromGeocoded(result: GeocodedLocation, source: SelectedLocation["source"]): SelectedLocation {
  return {
    label: result.formattedLabel || result.label,
    locality: result.locality,
    city: result.city,
    state: result.state,
    lat: result.lat,
    lng: result.lng,
    source,
    formattedLabel: result.formattedLabel || result.label,
    street: result.street,
    houseNumber: result.houseNumber,
    neighbourhood: result.neighbourhood,
    suburb: result.suburb,
    district: result.district,
    landmark: result.landmark,
    name: result.name,
  };
}

function locationDisplayLabel(location: SelectedLocation) {
  return location.formattedLabel || location.label;
}

export default function LocationSelector() {
  const { location, recentLocations, setLocation } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapInitial, setMapInitial] = useState<{ lat: number; lng: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mapTriggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTarget = previousFocus ?? triggerRef.current;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      window.setTimeout(() => restoreTarget?.focus(), 0);
    };
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      const clearTimer = window.setTimeout(() => {
        setResults([]);
        setIsSearching(false);
        setSearchError(null);
        setActiveIndex(-1);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = await response.json() as { results?: GeocodedLocation[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Location search is unavailable.");
        setResults(payload.results || []);
        setActiveIndex(-1);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Location search is unavailable.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!mapOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTarget = previousFocus ?? mapTriggerRef.current;
    return () => {
      window.setTimeout(() => restoreTarget?.focus(), 0);
    };
  }, [mapOpen]);

  function closeDialog() {
    setOpen(false);
    setQuery("");
    setStatus(null);
    setSearchError(null);
    setResults([]);
  }

  function chooseLocation(next: SelectedLocation) {
    setLocation(next);
    closeDialog();
  }

  function chooseResult(result: GeocodedLocation) {
    chooseLocation(selectedFromGeocoded(result, "search"));
  }

  async function reverseGeocode(lat: number, lng: number, source: "device" | "map") {
    const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
    const payload = await response.json() as { location?: GeocodedLocation | null; error?: string };
    if (!response.ok) throw new Error(payload.error || "We couldn’t identify that location.");
    if (!payload.location) throw new Error("We couldn’t find a place in Tamil Nadu at that point. Try another location.");
    chooseLocation(selectedFromGeocoded(payload.location, source));
  }

  function useCurrentLocation() {
    setStatus(null);
    if (!navigator.geolocation) {
      setStatus("Location access is not available in this browser. You can search or choose a point on the map instead.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void reverseGeocode(coords.latitude, coords.longitude, "device").catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : "We couldn’t look up your location. You can search instead.");
        });
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. You can search for a place or choose one on the map."
          : "We couldn’t get your location just now. You can search for a place or choose one on the map.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function handleMapConfirm(point: { lat: number; lng: number }) {
    void reverseGeocode(point.lat, point.lng, "map").catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "We couldn’t identify that map location. Try another point.");
      setMapOpen(false);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => index <= 0 ? results.length - 1 : index - 1);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        chooseResult(results[activeIndex]);
      } else if (results.length === 1) {
        event.preventDefault();
        chooseResult(results[0]);
      }
    }
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [role="option"], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const noResults = query.trim().length >= 3 && !isSearching && !searchError && results.length === 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={`Change location. Currently ${location.label}`}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 max-w-[46vw] shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:max-w-56"
      >
        <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="truncate">{location.locality || location.label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={dialogRef}
          aria-modal="true"
          aria-labelledby="location-dialog-title"
          role="dialog"
          tabIndex={-1}
          onKeyDown={trapFocus}
          className="fixed inset-0 m-0 flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 md:relative md:inset-auto md:h-[min(90dvh,760px)] md:w-full md:max-w-2xl md:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <DialogTitle id="location-dialog-title" className="mb-1">Choose your location</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {location.source === "default" ? "Showing Chidambaram. Change location" : `Showing ${locationDisplayLabel(location)}`}
              </p>
            </div>
            <button type="button" aria-label="Close location dialog" onClick={closeDialog} className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <label htmlFor="location-search" className="sr-only">Search for a locality, street, or landmark</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                id="location-search"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={query.trim().length >= 3}
                aria-controls="location-search-results"
                aria-activedescendant={activeIndex >= 0 ? `location-result-${activeIndex}` : undefined}
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setIsSearching(nextQuery.trim().length >= 3);
                  setSearchError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search locality, street, or landmark"
                className="min-h-12 w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <p className="sr-only" aria-live="polite">
              {isSearching ? "Searching locations" : `${results.length} locations found`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={useCurrentLocation} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MapPin aria-hidden="true" className="size-4" />
                Use current location
              </button>
              <button
                ref={mapTriggerRef}
                type="button"
                onClick={() => {
                  setStatus(null);
                  setMapInitial(location.lat !== null && location.lng !== null ? { lat: location.lat, lng: location.lng } : null);
                  setMapOpen(true);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MapPin aria-hidden="true" className="size-4" />
                Choose on map
              </button>
            </div>

            {status && <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{status}</p>}
            {searchError && <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{searchError}</p>}

            {query.trim().length < 3 && recentLocations.length > 0 && (
              <section aria-labelledby="recent-locations-heading" className="mt-6">
                <h3 id="recent-locations-heading" className="mb-2 text-sm font-semibold">Recent locations</h3>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {recentLocations.map((recent, index) => (
                    <li key={`${recent.label}-${index}`}>
                      <button type="button" onClick={() => chooseLocation(recent)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                        <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium" title={locationDisplayLabel(recent)}>{locationDisplayLabel(recent)}</span>
                          {recent.locality && !locationDisplayLabel(recent).toLocaleLowerCase().includes(recent.locality.toLocaleLowerCase()) && (
                            <span className="block truncate text-xs text-muted-foreground">{recent.locality}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(results.length > 0 || isSearching) && (
              <ul id="location-search-results" role="listbox" aria-label="Location search results" className="mt-3 max-h-[42dvh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {isSearching && <li className="px-3 py-4 text-sm text-muted-foreground">Searching…</li>}
                {!isSearching && results.map((result, index) => (
                  <li key={result.id}>
                    <button
                      id={`location-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => chooseResult(result)}
                      className={`flex min-h-12 w-full items-start gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${activeIndex === index ? "bg-muted" : "hover:bg-muted/70"}`}
                    >
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium" title={locationDisplayLabel(result)}>{locationDisplayLabel(result)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[result.locality, result.state].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {noResults && (
              <button
                type="button"
                onClick={() => chooseLocation({
                  label: query.trim(),
                  locality: query.trim(),
                  city: null,
                  state: "Tamil Nadu",
                  lat: null,
                  lng: null,
                  source: "manual",
                })}
                className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="text-sm">Use “{query.trim()}” anyway</span>
              </button>
            )}

            {location.source === "manual" && (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                This location is saved as entered. Results use a Tamil Nadu-wide search until a city is available.
              </p>
            )}
          </div>

          <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
            Search by Photon · © OpenStreetMap contributors
          </footer>
        </DialogContent>
      </Dialog>

      <LocationPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initial={mapInitial}
        fallbackCenter={{ lat: DEFAULT_LOCATION.lat ?? 11.3993, lng: DEFAULT_LOCATION.lng ?? 79.6914 }}
        title="Choose a location on the map"
        onConfirm={handleMapConfirm}
      />
    </>
  );
}
