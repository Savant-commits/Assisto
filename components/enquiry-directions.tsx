"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/db-errors";
import { directionsUrl, EXTERNAL_LINK_PROPS, isAllowedMapsUrl } from "@/lib/maps";

type EnquiryLocation = {
  address_text: string;
  maps_url: string | null;
};

type EnquiryDirectionsProps = {
  enquiryId: number;
  role: "customer" | "provider";
  providerLocation?: {
    locality?: string | null;
    maps_url?: string | null;
    city?: string | null;
  } | null;
};

export function EnquiryDirections({ enquiryId, role, providerLocation }: EnquiryDirectionsProps) {
  const [location, setLocation] = useState<EnquiryLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [addressText, setAddressText] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLocation() {
      setLoading(true);
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("enquiry_locations")
        .select("address_text, maps_url")
        .eq("enquiry_id", enquiryId)
        .maybeSingle();
      if (!active) return;

      if (loadError) {
        setError(friendlyDbError(loadError, "Unable to load the job site location."));
      } else {
        const nextLocation = data
          ? { address_text: data.address_text, maps_url: data.maps_url }
          : null;
        setLocation(nextLocation);
        setAddressText(nextLocation?.address_text ?? "");
        setMapsUrl(nextLocation?.maps_url ?? "");
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
    const cleanMapsUrl = mapsUrl.trim();
    setError(null);

    if (!cleanAddress) {
      setError("Please enter the job site address.");
      return;
    }
    if (cleanMapsUrl && !isAllowedMapsUrl(cleanMapsUrl)) {
      setError("Please paste a link from Google Maps.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("enquiry_locations")
        .update({ address_text: cleanAddress, maps_url: cleanMapsUrl || null })
        .eq("enquiry_id", enquiryId);
      if (updateError) {
        setError(friendlyDbError(updateError, "Unable to update the job site location."));
        return;
      }

      const savedLocation = { address_text: cleanAddress, maps_url: cleanMapsUrl || null };
      setLocation(savedLocation);
      setAddressText(savedLocation.address_text);
      setMapsUrl(savedLocation.maps_url ?? "");
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

  if (role === "customer") {
    const providerDirections = directionsUrl({
      mapsUrl: providerLocation?.maps_url,
      address: providerLocation?.locality,
      city: providerLocation?.city,
    });

    return (
      <div className="mt-3 space-y-3">
        {providerDirections && (
          <a
            href={providerDirections}
            {...EXTERNAL_LINK_PROPS}
            className="inline-flex rounded-md border px-3 py-1.5 text-sm font-medium text-blue-700 underline"
          >
            Directions to provider
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
                  setMapsUrl(location.maps_url ?? "");
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
              <input
                type="text"
                value={mapsUrl}
                onChange={(event) => setMapsUrl(event.target.value)}
                maxLength={300}
                placeholder="Google Maps pin link (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                    setMapsUrl(location?.maps_url ?? "");
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

  const jobSiteDirections = location
    ? directionsUrl({ mapsUrl: location.maps_url, address: location.address_text })
    : null;

  return (
    <div className="mt-3 rounded-md border border-muted p-3 text-sm">
      <p className="font-medium">Job site location</p>
      {loading ? (
        <p className="mt-1 text-muted-foreground">Loading site location…</p>
      ) : location ? (
        <>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{location.address_text}</p>
          {jobSiteDirections && (
            <a
              href={jobSiteDirections}
              {...EXTERNAL_LINK_PROPS}
              className="mt-2 inline-flex rounded-md border px-3 py-1.5 font-medium text-blue-700 underline"
            >
              Directions to job site
            </a>
          )}
        </>
      ) : (
        <p className="mt-1 text-muted-foreground">The customer hasn&apos;t shared a site location yet.</p>
      )}
      {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
