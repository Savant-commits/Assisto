"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker } from "@/components/map/location-picker";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { GeocodedLocation } from "@/lib/location/types";

const SavedLocationMap = dynamic(
  () => import("@/components/map/leaflet-map-inner").then((module) => module.LeafletMapInner),
  { ssr: false, loading: () => <div className="aspect-[16/9] w-full animate-pulse rounded-xl bg-muted motion-reduce:animate-none" /> },
);

type PrivateAddress = {
  street: string | null;
  house_number: string | null;
  area: string | null;
  city: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
};

type AddressFields = {
  street: string;
  houseNumber: string;
  area: string;
  city: string;
  pincode: string;
};

const emptyFields: AddressFields = {
  street: "",
  houseNumber: "",
  area: "",
  city: "",
  pincode: "",
};

function fieldsFromAddress(address: PrivateAddress | null): AddressFields {
  return {
    street: address?.street ?? "",
    houseNumber: address?.house_number ?? "",
    area: address?.area ?? "",
    city: address?.city ?? "",
    pincode: address?.pincode ?? "",
  };
}

function fieldsFromGeocoded(location: GeocodedLocation): AddressFields {
  const city = location.city ?? "";
  const mostSpecificArea = location.neighbourhood ?? location.suburb ??
    (location.locality && location.locality !== city ? location.locality : "") ?? "";
  return {
    street: location.street ?? "",
    houseNumber: location.houseNumber ?? "",
    area: mostSpecificArea,
    city,
    pincode: location.postcode ?? "",
  };
}

export function PrivateProfileAddress({
  profileId,
  isEditing,
  canEdit,
  onEdit,
  onCancel,
  onSaved,
}: {
  profileId: string;
  isEditing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [address, setAddress] = useState<PrivateAddress | null>(null);
  const [fields, setFields] = useState<AddressFields>(emptyFields);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element || mapVisible || address?.lat == null || address.lng == null) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setMapVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [address?.lat, address?.lng, mapVisible]);

  useEffect(() => {
    if (!isEditing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    };
  }, [isEditing]);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (!userData.user || authError || userData.user.id !== profileId) {
        if (mounted) {
          setAddress(null);
          setIsLoading(false);
        }
        return;
      }

      const { data, error: addressError } = await supabase
        .from("profile_private_addresses")
        .select("street,house_number,area,city,pincode,lat,lng")
        .eq("profile_id", userData.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (addressError) {
        // Missing migration/table and denied access both degrade to the private-address prompt.
        setAddress(null);
      } else {
        const saved = data as PrivateAddress | null;
        setAddress(saved);
        setFields(fieldsFromAddress(saved));
        setCoordinates(saved?.lat !== null && saved?.lat !== undefined && saved?.lng !== null && saved?.lng !== undefined
          ? { lat: saved.lat, lng: saved.lng }
          : null);
      }
      setIsLoading(false);
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [profileId]);

  useEffect(() => {
    const query = addressQuery.trim();
    if (!isEditing || query.length < 3) {
      const timer = window.setTimeout(() => {
        setResults([]);
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json() as { results?: GeocodedLocation[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Address search is unavailable.");
        setResults(payload.results ?? []);
      } catch (lookupError) {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus(lookupError instanceof Error ? lookupError.message : "Address search is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [addressQuery, isEditing]);

  function selectGeocodedLocation(location: GeocodedLocation) {
    setFields(fieldsFromGeocoded(location));
    setCoordinates(location.lat !== null && location.lng !== null
      ? { lat: location.lat, lng: location.lng }
      : null);
    setAddressQuery(location.formattedLabel || location.label);
    setResults([]);
    setError(null);
    setStatus("Review and edit the address details before saving.");
  }

  async function fillFromCoordinates(point: { lat: number; lng: number }) {
    setIsLookingUp(true);
    setError(null);
    setStatus(null);
    setCoordinates(point);
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(point.lat))}&lng=${encodeURIComponent(String(point.lng))}`);
      const payload = await response.json() as { location?: GeocodedLocation | null; error?: string };
      if (payload.location) {
        selectGeocodedLocation(payload.location);
      } else {
        setFields(emptyFields);
        setAddressQuery("");
        setStatus("No address details were returned for this point. You can enter them manually.");
      }
      if (!response.ok && !payload.location) setStatus(payload.error || "No address details were returned. Enter them manually.");
    } catch {
      setFields(emptyFields);
      setAddressQuery("");
      setStatus("Address lookup is unavailable. You can enter the address manually.");
    } finally {
      setIsLookingUp(false);
    }
  }

  function useCurrentLocation() {
    setError(null);
    setStatus(null);
    if (!navigator.geolocation) {
      setStatus("Location access is unavailable in this browser. You can still search or enter the address manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords: point }) => void fillFromCoordinates({ lat: point.latitude, lng: point.longitude }),
      (geoError) => setStatus(geoError.code === geoError.PERMISSION_DENIED
        ? "Location permission was denied. You can choose a point on the map or enter the address manually."
        : "Could not get your location. You can choose a point on the map or enter the address manually."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const pincode = fields.pincode.trim();
    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError("Enter a 6-digit PIN code, or leave it blank.");
      return;
    }
    if (![fields.street, fields.houseNumber, fields.area, fields.city, pincode].some((value) => value.trim())) {
      setError("Enter at least one address detail before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user || userData.user.id !== profileId) {
        setError("Please sign in again to save your address.");
        return;
      }

      const { data, error: saveError } = await supabase
        .from("profile_private_addresses")
        .upsert({
          profile_id: userData.user.id,
          street: fields.street.trim() || null,
          house_number: fields.houseNumber.trim() || null,
          area: fields.area.trim() || null,
          city: fields.city.trim() || null,
          pincode: pincode || null,
          lat: coordinates?.lat ?? null,
          lng: coordinates?.lng ?? null,
        }, { onConflict: "profile_id" })
        .select("street,house_number,area,city,pincode,lat,lng")
        .single();

      if (saveError || !data) {
        setError("Address saving is unavailable right now. You can still edit your profile; please try again later.");
        return;
      }
      const saved = data as PrivateAddress;
      setAddress(saved);
      setFields(fieldsFromAddress(saved));
      setStatus("Address saved privately to your profile.");
      onSaved();
    } catch {
      setError("Address saving is unavailable right now. Please try again later.");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelAddressEdit() {
    setFields(fieldsFromAddress(address));
    setCoordinates(address?.lat !== null && address?.lat !== undefined && address?.lng !== null && address?.lng !== undefined
      ? { lat: address.lat, lng: address.lng }
      : null);
    setAddressQuery("");
    setResults([]);
    setError(null);
    setStatus(null);
    onCancel();
  }

  if (isLoading) {
    return <section aria-labelledby="private-address-heading" aria-busy="true" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 id="private-address-heading" className="font-display text-xl">Address</h2>
      <div className="mt-3 h-4 w-44 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </section>;
  }

  return (
    <>
      <section aria-labelledby="private-address-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="private-address-heading" className="font-display text-xl">Address</h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Private: only you can see this</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={onEdit} disabled={!canEdit}>
            {address ? "Edit" : "Add your address"}
          </Button>
        </div>

        {address ? (
          <div className="mt-4 space-y-1 text-sm leading-6 text-foreground">
            {[ [address.house_number, address.street].filter(Boolean).join(" "), address.area, address.city, address.pincode ]
              .filter((line): line is string => Boolean(line))
              .map((line, index) => <p key={`${index}-${line}`} className="break-words">{line}</p>)}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Add an address to keep it available privately in your profile.</p>
        )}

        {address?.lat !== null && address?.lat !== undefined && address.lng !== null && address.lng !== undefined ? (
          <div ref={mapContainerRef} className="mt-5 aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted" aria-label="Map showing your saved location">
            {mapVisible ? (
              <SavedLocationMap center={{ lat: address.lat, lng: address.lng }} marker={{ lat: address.lat, lng: address.lng }} zoom={17} interactive="static" height="100%" />
            ) : (
              <div aria-hidden="true" className="h-full w-full animate-pulse bg-muted motion-reduce:animate-none" />
            )}
          </div>
        ) : (
          <button type="button" disabled={!canEdit} onClick={onEdit} className="mt-5 flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 text-left text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
            Drop a pin so providers can find you
          </button>
        )}
      </section>

      <Dialog open={isEditing} onOpenChange={(open) => { if (!open) cancelAddressEdit(); }}>
        <DialogContent
          aria-modal="true"
          aria-labelledby="private-address-editor-title"
          role="dialog"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          className="fixed inset-0 m-0 flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 md:relative md:inset-auto md:h-[min(90dvh,800px)] md:w-full md:max-w-2xl md:rounded-2xl"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <DialogTitle id="private-address-editor-title" className="font-display text-xl">Your private address</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">Private: only you can see this</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Close address editor" onClick={cancelAddressEdit}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <label htmlFor="profile-address-search" className="mb-1 block text-sm font-medium">Search address or landmark</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input ref={searchInputRef} id="profile-address-search" value={addressQuery} onChange={(event) => setAddressQuery(event.target.value)} placeholder="Type a street, area, or landmark" autoComplete="off" />
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setIsLocationPickerOpen(true)}>Choose on map</Button>
            </div>
            {(isSearching || results.length > 0) && (
              <ul aria-label="Address search results" className="mt-2 max-h-52 divide-y overflow-y-auto rounded-lg border border-border">
                {isSearching && <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>}
                {!isSearching && results.map((result) => (
                  <li key={result.id}>
                    <button type="button" onClick={() => selectGeocodedLocation(result)} className="min-h-12 w-full px-3 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="block truncate text-sm font-medium">{result.formattedLabel || result.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[result.locality, result.state].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={useCurrentLocation} disabled={isLookingUp}>{isLookingUp ? "Looking up…" : "Use current location"}</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => {
                setFields(emptyFields);
                setCoordinates(null);
                setAddressQuery("");
                setResults([]);
                setError(null);
                setStatus("Enter the address details below.");
              }}>Enter address manually</Button>
            </div>

            <form id="private-address-form" onSubmit={saveAddress} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-address-house-number" className="mb-1 block text-sm font-medium">House number</label>
                  <Input id="profile-address-house-number" value={fields.houseNumber} maxLength={50} onChange={(event) => setFields((current) => ({ ...current, houseNumber: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="profile-address-street" className="mb-1 block text-sm font-medium">Street</label>
                  <Input id="profile-address-street" value={fields.street} maxLength={200} onChange={(event) => setFields((current) => ({ ...current, street: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="profile-address-area" className="mb-1 block text-sm font-medium">Area / neighbourhood</label>
                  <Input id="profile-address-area" value={fields.area} maxLength={200} onChange={(event) => setFields((current) => ({ ...current, area: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="profile-address-city" className="mb-1 block text-sm font-medium">City</label>
                  <Input id="profile-address-city" value={fields.city} maxLength={120} onChange={(event) => setFields((current) => ({ ...current, city: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="profile-address-pincode" className="mb-1 block text-sm font-medium">PIN code</label>
                  <Input id="profile-address-pincode" value={fields.pincode} type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} onChange={(event) => setFields((current) => ({ ...current, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) }))} />
                  {!fields.pincode && <p className="mt-1 text-xs text-muted-foreground">Not found for this spot, please add it</p>}
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
            </form>
          </div>

          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button type="button" variant="outline" className="min-h-11" onClick={cancelAddressEdit} disabled={isSaving}>Cancel</Button>
            <Button type="submit" form="private-address-form" className="min-h-11" disabled={isSaving || isLookingUp}>{isSaving ? "Saving…" : "Save address"}</Button>
          </footer>
          <LocationPicker open={isLocationPickerOpen} onOpenChange={setIsLocationPickerOpen} title="Choose your address on the map" confirmLabel="Use this location" onConfirm={(point) => void fillFromCoordinates(point)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
