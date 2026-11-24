"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { EnquiryDetailsFields, type EnquiryDetailsValue } from "@/components/enquiries/enquiry-details-fields";

type Pin = { lat: number; lng: number };
type Props = {
  enquiryId: number;
  isAsap: boolean | null;
  scheduledStartAt: string | null;
  homeAddress: string;
  homeCity: string | null;
  homePin: Pin | null;
  fallbackCenter: Pin;
  today: string;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onSaveDetails: (details: EnquiryDetailsValue) => Promise<boolean>;
};

function showSchedule(isAsap: boolean | null, scheduledStartAt: string | null) {
  if (isAsap) return "ASAP";
  if (scheduledStartAt) return new Date(scheduledStartAt).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return "Not set";
}

export function ConfirmationStep({
  enquiryId,
  isAsap,
  scheduledStartAt,
  homeAddress,
  homeCity,
  homePin,
  fallbackCenter,
  today,
  saving,
  error,
  onConfirm,
  onSaveDetails,
}: Props) {
  const [location, setLocation] = useState<{ addressText: string; lat: number | null; lng: number | null } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [details, setDetails] = useState<EnquiryDetailsValue | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const updateDetails = useCallback((value: EnquiryDetailsValue) => setDetails(value), []);

  useEffect(() => {
    let active = true;
    async function loadLocation() {
      setLoadingLocation(true);
      const supabase = createClient();
      const { data, error: locationError } = await supabase
        .from("enquiry_locations")
        .select("address_text,lat,lng")
        .eq("enquiry_id", enquiryId)
        .maybeSingle();
      if (!active) return;
      if (locationError) {
        setLoadError("Unable to load the work location. You can edit and save it again.");
      } else if (data) {
        setLocation({ addressText: data.address_text, lat: data.lat, lng: data.lng });
      }
      setLoadingLocation(false);
    }
    void loadLocation();
    return () => { active = false; };
  }, [enquiryId]);

  async function saveDetails() {
    if (!details?.isValid || saving) return;
    const saved = await onSaveDetails(details);
    if (!saved) return;
    setLocation({ addressText: details.addressText, lat: details.lat, lng: details.lng });
    setIsEditing(false);
  }

  return (
    <section aria-label="Confirm enquiry" className="mt-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <h3 className="font-display text-xl">Job details</h3>
      {isEditing ? (
        <div className="mt-4 space-y-4">
          <EnquiryDetailsFields
            homeAddress={homeAddress}
            homeCity={homeCity}
            homePin={homePin}
            fallbackCenter={fallbackCenter}
            today={today}
            initial={{
              isAsap: isAsap ?? true,
              scheduledStartAt,
              addressText: location?.addressText ?? homeAddress,
              lat: location?.lat ?? null,
              lng: location?.lng ?? null,
              place: location?.addressText === homeAddress ? "home" : "different",
            }}
            onChange={updateDetails}
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={() => void saveDetails()} disabled={saving || !details?.isValid} className="min-h-11 rounded-full px-5">{saving ? "Saving…" : "Save details"}</Button>
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="min-h-11 rounded-full px-5">Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <dl className="mt-4 space-y-3 rounded-xl border border-border bg-background/70 p-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{showSchedule(isAsap, scheduledStartAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Where</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{loadingLocation ? "Loading location…" : location?.addressText || homeAddress || homeCity || "Location not saved"}</dd>
            </div>
          </dl>
          {(loadError || error) && <p role="alert" className="mt-3 text-sm text-destructive">{loadError || error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onConfirm} disabled={saving || loadingLocation} className="min-h-11 rounded-full px-5">{saving ? "Confirming…" : "Confirm"}</Button>
            <button type="button" onClick={() => { setLoadError(null); setIsEditing(true); }} disabled={saving} className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Edit details</button>
          </div>
        </>
      )}
    </section>
  );
}