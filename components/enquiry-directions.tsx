"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/db-errors";
import { coordsDirectionsUrl, DEFAULT_MAP_CENTER, directionsUrl, EXTERNAL_LINK_PROPS, CITY_CENTERS } from "@/lib/maps";
import { LocationMap } from "@/components/map/location-map";
import { LocationPicker } from "@/components/map/location-picker";

type EnquiryLocation = {
  address_text: string;
  lat: number | null;
  lng: number | null;
};

type EnquiryDirectionsProps = {
  enquiryId: number;
  role: "customer" | "provider";
  providerLocation?: {
    lat?: number | null;
    lng?: number | null;
    locality?: string | null;
    city?: string | null;
  } | null;
};

export function EnquiryDirections({ enquiryId, role, providerLocation }: EnquiryDirectionsProps) {
  const [location, setLocation] = useState<EnquiryLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLocation() {
      setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("enquiry_locations")
        .select("address_text, lat, lng")
        .eq("enquiry_id", enquiryId)
        .maybeSingle();
      if (!active) return;

      if (loadError) {
        setError(friendlyDbError(loadError, "Unable to load the job site location."));
      } else {
        const nextLocation = data ? { address_text: data.address_text, lat: data.lat, lng: data.lng } : null;
        setLocation(nextLocation);
        setAddressText(nextLocation?.address_text ?? "");
        setLat(nextLocation?.lat ?? null);
        setLng(nextLocation?.lng ?? null);
      }
      setLoading(false);
    }
    void loadLocation();
    return () => {
      active = false;
    };
  }, [enquiryId]);

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAddress = addressText.trim();
    setError(null);

    if (!cleanAddress) {
      setError("Please enter the job site address.");
      return;
    }
    if (lat === null || lng === null) {
      setError("Please drop a pin for the job site.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("enquiry_locations")
        .update({ address_text: cleanAddress, lat, lng })
        .eq("enquiry_id", enquiryId);
      if (updateError) {
        setError(friendlyDbError(updateError, "Unable to update the job site location."));
        return;
      }

      const savedLocation = { address_text: cleanAddress, lat, lng };
      setLocation(savedLocation);
      setAddressText(savedLocation.address_text);
      setLat(savedLocation.lat);
      setLng(savedLocation.lng);
      setIsEditing(false);
    } catch (saveError: unknown) {
      setError(
        friendlyDbError(
          saveError && typeof saveError === "object" ? saveError as { message?: string; code?: string } : null,
          "Unable to update the job site location."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const fallbackCenter = providerLocation?.city && providerLocation.city in CITY_CENTERS
    ? CITY_CENTERS[providerLocation.city as keyof typeof CITY_CENTERS]
    : DEFAULT_MAP_CENTER;

  const providerHasPin = providerLocation?.lat != null && providerLocation.lng != null;
  const providerDirections = providerHasPin
    ? coordsDirectionsUrl(providerLocation.lat!, providerLocation.lng!)
    : directionsUrl({ address: providerLocation?.locality, city: providerLocation?.city });

  if (role === "customer") {
    return (
      <div className="space-y-3">
        {providerDirections && (
          <a
            href={providerDirections}
            {...EXTERNAL_LINK_PROPS}
            className="inline-flex whitespace-nowrap rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-blue-700 underline"
          >
            Show directions
          </a>
        )}
        <div className="rounded-md border border-muted p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Your job site</p>
            {!loading && location && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAddressText(location.address_text);
                  setLat(location.lat ?? null);
                  setLng(location.lng ?? null);
                  setIsEditing(true);
                }}
                className="text-xs text-blue-700 underline"
              >
                Edit
              </button>
            )}
          </div>
          {loading ? (
            <p className="mt-1 text-muted-foreground">Loading site location…</p>
          ) : isEditing ? (
            <form onSubmit={saveLocation} className="mt-2 space-y-2">
              <textarea
                value={addressText}
                onChange={(event) => setAddressText(event.target.value)}
                maxLength={300}
                required
                rows={3}
                placeholder="House/street, landmark, area"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {lat !== null && lng !== null ? (
                <div className="space-y-2">
                  <LocationMap lat={lat} lng={lng} height={180} />
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                  >
                    Change pin
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                >
                  Drop pin on map
                </button>
              )}
              <LocationPicker
                open={isPickerOpen}
                onOpenChange={setIsPickerOpen}
                initial={lat !== null && lng !== null ? { lat, lng } : null}
                fallbackCenter={fallbackCenter}
                title="Job site location"
                confirmLabel="Use this pin"
                onConfirm={({ lat: nextLat, lng: nextLng }) => {
                  setLat(nextLat);
                  setLng(nextLng);
                }}
              />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    setAddressText(location?.address_text ?? "");
                    setLat(location?.lat ?? null);
                    setLng(location?.lng ?? null);
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : location ? (
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{location.address_text}</p>
          ) : (
            <p className="mt-1 text-muted-foreground">No site location saved yet.</p>
          )}
          {!isEditing && error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  const locationHasPin = location?.lat != null && location.lng != null;
  const jobSiteDirections = locationHasPin
    ? coordsDirectionsUrl(location.lat!, location.lng!)
    : directionsUrl({ address: location?.address_text });

  return (
    <div className="space-y-2">
      {jobSiteDirections && (
        <a
          href={jobSiteDirections}
          {...EXTERNAL_LINK_PROPS}
          className="inline-flex whitespace-nowrap rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-blue-700 underline"
        >
          Show directions
        </a>
      )}
      <div className="rounded-md border border-muted p-3 text-sm">
        <p className="font-medium">Job site location</p>
        {loading ? (
          <p className="mt-1 text-muted-foreground">Loading site location…</p>
        ) : location ? (
          <>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{location.address_text}</p>
            {locationHasPin && location.lat !== null && location.lng !== null && (
              <div className="mt-2">
                <LocationMap lat={location.lat} lng={location.lng} height={160} />
              </div>
            )}
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">The customer hasn&apos;t shared a site location yet.</p>
        )}
        {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
      </div>
    </div>
  );
}
