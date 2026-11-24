"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EnquiryDetailsFields, type EnquiryDetailsValue } from "@/components/enquiries/enquiry-details-fields";
import { createClient } from "@/lib/supabase/client";

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
  onClose: () => void;
  onSaved: (details: EnquiryDetailsValue) => void;
};

export function RequestDetailsEditor({
  enquiryId,
  isAsap,
  scheduledStartAt,
  homeAddress,
  homeCity,
  homePin,
  fallbackCenter,
  today,
  onClose,
  onSaved,
}: Props) {
  const [initial, setInitial] = useState<Partial<EnquiryDetailsValue> | null>(null);
  const [details, setDetails] = useState<EnquiryDetailsValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateDetails = useCallback((value: EnquiryDetailsValue) => setDetails(value), []);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("enquiry_locations")
        .select("address_text,lat,lng")
        .eq("enquiry_id", enquiryId)
        .maybeSingle();
      if (!active) return;
      if (loadError) {
        setError("Unable to load saved location. You can still update the details and retry.");
      }
      setInitial({
        isAsap: isAsap ?? true,
        scheduledStartAt,
        addressText: data?.address_text ?? homeAddress,
        lat: data?.lat ?? homePin?.lat ?? null,
        lng: data?.lng ?? homePin?.lng ?? null,
        place: !data || data.address_text === homeAddress ? "home" : "different",
      });
    }
    void load();
    return () => { active = false; };
  }, [enquiryId, homeAddress, homePin, isAsap, scheduledStartAt]);

  async function save() {
    if (!details?.isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again to edit this request.");
      const { error: enquiryError } = await supabase.from("enquiries").update({
        is_asap: details.isAsap,
        scheduled_start_at: details.isAsap ? null : details.scheduledStartAt,
      }).eq("id", enquiryId);
      if (enquiryError) throw enquiryError;
      const { error: locationError } = await supabase.from("enquiry_locations").upsert({
        enquiry_id: enquiryId,
        customer_id: authData.user.id,
        address_text: details.addressText,
        lat: details.lat,
        lng: details.lng,
      }, { onConflict: "enquiry_id" });
      if (locationError) throw locationError;
      onSaved(details);
      onClose();
    } catch (saveError: unknown) {
      setError(saveError && typeof saveError === "object" && "message" in saveError && typeof saveError.message === "string"
        ? saveError.message
        : "Unable to save these details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!initial) return <p className="mt-3 text-sm text-muted-foreground">Loading saved details…</p>;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-border bg-background p-3">
      <EnquiryDetailsFields
        homeAddress={homeAddress}
        homeCity={homeCity}
        homePin={homePin}
        fallbackCenter={fallbackCenter}
        today={today}
        initial={initial}
        onChange={updateDetails}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || !details?.isValid} className="min-h-11 rounded-full px-5">{saving ? "Saving…" : "Save details"}</Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-11 rounded-full px-5">Cancel</Button>
      </div>
    </div>
  );
}
