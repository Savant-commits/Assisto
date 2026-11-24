"use client";

import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationMap } from "@/components/map/location-map";
import { LocationPicker } from "@/components/map/location-picker";
import { coordsViewUrl, CITY_CENTERS } from "@/lib/maps";
import type { GeocodedLocation } from "@/lib/location/types";

type Pin = { lat: number; lng: number };
type Props = {
  enquiryId: number;
  homeAddress: string;
  hasSavedHomeAddress: boolean;
  homeMapsUrl: string | null;
  homeCity: string | null;
  fallbackCenter: Pin;
  today: string;
  saving: boolean;
  error: string | null;
  locationError: string | null;
  onCancel: () => void;
  onConfirm: (schedule: { isAsap: boolean; scheduledStartAt: string | null }, location: { addressText: string; mapsUrl: string | null }) => void;
};

function localFutureDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function ConfirmationStep({
  enquiryId,
  homeAddress,
  hasSavedHomeAddress,
  homeMapsUrl,
  homeCity,
  fallbackCenter,
  today,
  saving,
  error,
  locationError,
  onCancel,
  onConfirm,
}: Props) {
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<"home" | "different">("home");
  const [addressText, setAddressText] = useState(homeAddress);
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(homeMapsUrl);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCenter, setPickerCenter] = useState(fallbackCenter);
  const [resolvingCenter, setResolvingCenter] = useState(false);
  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scheduleExpired, setScheduleExpired] = useState(false);
  const addressRevisionRef = useRef(0);
  const reverseRequestRef = useRef(0);

  const futureMinute = new Date(nowMs + 60_000);
  const minTime = date === today ? `${String(futureMinute.getHours()).padStart(2, "0")}:${String(futureMinute.getMinutes()).padStart(2, "0")}` : undefined;
  const scheduledAt = localFutureDateTime(date, time);
  const scheduleIsInvalid = when === "schedule" && (!scheduledAt || scheduledAt.getTime() <= nowMs || scheduleExpired);
  const addressIsInvalid = !addressText.trim();

  async function openLocationPicker() {
    setResolvingCenter(true);
    let center = fallbackCenter;
    const knownCenter = homeCity && homeCity in CITY_CENTERS
      ? CITY_CENTERS[homeCity as keyof typeof CITY_CENTERS]
      : null;
    if (knownCenter) {
      center = knownCenter;
    } else if (homeCity?.trim() && homeCity.trim().length >= 3) {
      try {
        const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(homeCity.trim())}`);
        const payload = await response.json() as { results?: GeocodedLocation[] };
        const result = payload.results?.find((item) => (item.city || item.locality).trim().toLocaleLowerCase() === homeCity.trim().toLocaleLowerCase());
        if (response.ok && result && typeof result.lat === "number" && typeof result.lng === "number") {
          center = { lat: result.lat, lng: result.lng };
        }
      } catch {
        // Fall back to the currently selected Home location if the town lookup fails.
      }
    }
    setPickerCenter(center);
    setPickerOpen(true);
    setResolvingCenter(false);
  }

  async function handlePin(point: Pin, suggestion?: GeocodedLocation | null) {
    setPin(point);
    setMapsUrl(coordsViewUrl(point.lat, point.lng));
    const revision = addressRevisionRef.current;
    const requestId = ++reverseRequestRef.current;
    const suggestionText = suggestion?.formattedLabel?.trim() || suggestion?.label?.trim() || suggestion?.city?.trim();
    if (suggestionText) {
      if (revision === addressRevisionRef.current && requestId === reverseRequestRef.current) setAddressText(suggestionText);
      setLookingUpAddress(false);
      return;
    }

    setLookingUpAddress(true);
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(point.lat))}&lng=${encodeURIComponent(String(point.lng))}`);
      const payload = await response.json() as { location?: GeocodedLocation | null };
      const result = payload.location;
      const resolvedText = result?.formattedLabel?.trim() || result?.label?.trim() || result?.city?.trim();
      if (response.ok && resolvedText && revision === addressRevisionRef.current && requestId === reverseRequestRef.current) setAddressText(resolvedText);
    } catch {
      // A reverse-geocode failure never blocks address entry or confirmation.
    } finally {
      if (requestId === reverseRequestRef.current) setLookingUpAddress(false);
    }
  }

  function confirm() {
    if (when === "schedule" && scheduledAt && scheduledAt.getTime() <= Date.now()) {
      setNowMs(Date.now());
      setScheduleExpired(true);
      return;
    }
    if (scheduleIsInvalid || addressIsInvalid || saving) return;
    onConfirm(
      { isAsap: when === "now", scheduledStartAt: when === "schedule" ? scheduledAt!.toISOString() : null },
      { addressText: addressText.trim(), mapsUrl },
    );
  }

  return (
    <section aria-label="Confirm enquiry" className="mt-4 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <h3 className="font-display text-xl">Confirm the job details</h3>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">When</p>
        <div role="group" aria-label="When should the work happen?" className="flex w-full rounded-full border border-border bg-background p-1">
          {([['now', 'Now'], ['schedule', 'Schedule']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={when === value} onClick={() => setWhen(value)} className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${when === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        {when === "schedule" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>Date</span>
              <Input type="date" min={today} value={date} onChange={(event) => { setNowMs(Date.now()); setScheduleExpired(false); setDate(event.target.value); }} className="min-h-12 rounded-xl bg-background text-foreground" />
            </label>
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>Time</span>
              <Input type="time" min={minTime} value={time} onChange={(event) => { setNowMs(Date.now()); setScheduleExpired(false); setTime(event.target.value); }} className="min-h-12 rounded-xl bg-background text-foreground" />
            </label>
            {scheduleIsInvalid && <p className="text-sm text-destructive sm:col-span-2">Choose a future date and time.</p>}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-foreground">Work location</p>
        <div role="group" aria-label="Choose the work location" className="flex w-full rounded-full border border-border bg-background p-1">
          {([['home', 'My home'], ['different', 'Different location']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={place === value} onClick={() => {
              const next = value as "home" | "different";
              setPlace(next);
              if (next === "home") {
                addressRevisionRef.current += 1;
                setAddressText(homeAddress);
                setPin(null);
                setMapsUrl(homeMapsUrl);
              } else {
                addressRevisionRef.current += 1;
                setAddressText("");
                setPin(null);
                setMapsUrl(null);
              }
            }} className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${place === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>

        {place === "home" ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">{homeAddress || homeCity || "Home town not provided"}</p>
            {!hasSavedHomeAddress && <Link href="/profile" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Add your address</Link>}
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor={`different-address-${enquiryId}`} className="block text-sm font-medium text-foreground">Address or area</label>
            <textarea
              id={`different-address-${enquiryId}`}
              value={addressText}
              onChange={(event) => {
                addressRevisionRef.current += 1;
                setAddressText(event.target.value);
              }}
              maxLength={300}
              rows={3}
              placeholder="House/street, landmark, area"
              className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {addressIsInvalid && <p className="text-sm text-destructive">Enter an address or area to continue.</p>}
            {lookingUpAddress && <p role="status" className="text-xs text-muted-foreground">Filling in the address suggestion… You can keep typing.</p>}
            {pin && <LocationMap lat={pin.lat} lng={pin.lng} height={180} />}
            <button type="button" onClick={() => void openLocationPicker()} disabled={resolvingCenter} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MapPin aria-hidden="true" className="size-4" />{resolvingCenter ? "Opening map…" : pin ? "Change pin (optional)" : "Add map pin (optional)"}
            </button>
            <LocationPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              initial={pin}
              fallbackCenter={pickerCenter}
              title="Different work location"
              confirmLabel="Use pin"
              lookupSuggestion={false}
              onConfirm={(nextPin, suggestion) => { void handlePin(nextPin, suggestion); }}
            />
          </div>
        )}
      </div>

      {locationError && <p role="alert" className="mt-3 text-sm text-destructive">{locationError}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={confirm} disabled={saving || scheduleIsInvalid || addressIsInvalid} className="min-h-11 rounded-full px-5">{saving ? "Confirming…" : "Confirm"}</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-11 rounded-full px-5">Cancel</Button>
      </div>
    </section>
  );
}
