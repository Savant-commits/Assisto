"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPicker } from "@/components/map/location-picker";
import { createClient } from "@/lib/supabase/client";
import type { GeocodedLocation } from "@/lib/location/types";

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
  editable,
  onEdit,
}: {
  profileId: string;
  editable: boolean;
  onEdit: () => void;
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
    if (!editable || query.length < 3) {
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
  }, [addressQuery, editable]);

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
  }

  if (isLoading) {
    return <section aria-labelledby="private-address-heading" aria-busy="true" className="space-y-2">
      <h2 id="private-address-heading" className="text-sm font-medium text-muted-foreground">Address</h2>
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
    </section>;
  }

  if (!editable) {
    return (
      <section aria-labelledby="private-address-heading" className="space-y-1">
        <h2 id="private-address-heading" className="text-sm font-medium text-muted-foreground">Address</h2>
        {address ? (
          <div className="space-y-0.5 text-base">
            {address.house_number && <p>{address.house_number}</p>}
            {address.street && <p>{address.street}</p>}
            {address.area && <p>{address.area}</p>}
            {address.city && <p>{address.city}</p>}
            {address.pincode && <p>{address.pincode}</p>}
          </div>
        ) : (
          <Button type="button" variant="link" className="h-auto px-0 text-sm" onClick={onEdit}>
            Add your address
          </Button>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="private-address-heading" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 id="private-address-heading" className="mb-1 text-lg font-semibold">Your private address</h2>
      <p className="mb-4 text-sm text-muted-foreground">Only you can see this address. It is not your public business location.</p>

      <label htmlFor="profile-address-search" className="mb-1 block text-sm font-medium">Search address or landmark</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="profile-address-search"
          value={addressQuery}
          onChange={(event) => setAddressQuery(event.target.value)}
          placeholder="Type a street, area, or landmark"
          autoComplete="off"
        />
        <Button type="button" variant="outline" onClick={() => setIsLocationPickerOpen(true)}>Choose on map</Button>
      </div>
      {(isSearching || results.length > 0) && (
        <ul aria-label="Address search results" className="mt-2 max-h-52 divide-y overflow-y-auto rounded-lg border border-border">
          {isSearching && <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>}
          {!isSearching && results.map((result) => (
            <li key={result.id}>
              <button type="button" onClick={() => selectGeocodedLocation(result)} className="w-full px-3 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="block truncate text-sm font-medium">{result.formattedLabel || result.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{[result.locality, result.state].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={isLookingUp}>
          {isLookingUp ? "Looking up…" : "Use current location"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => {
          setFields(emptyFields);
          setCoordinates(null);
          setAddressQuery("");
          setResults([]);
          setError(null);
          setStatus("Enter the address details below.");
        }}>
          Enter address manually
        </Button>
      </div>

      <form onSubmit={saveAddress} className="mt-5 space-y-3">
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
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving || isLookingUp}>{isSaving ? "Saving…" : "Save address"}</Button>
          <Button type="button" variant="outline" onClick={cancelAddressEdit} disabled={isSaving}>Cancel address changes</Button>
        </div>
      </form>

      <LocationPicker
        open={isLocationPickerOpen}
        onOpenChange={setIsLocationPickerOpen}
        title="Choose your address on the map"
        confirmLabel="Use this location"
        onConfirm={(point) => void fillFromCoordinates(point)}
      />
    </section>
  );
}
