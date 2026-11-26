"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocationMap } from "@/components/map/location-map";
import { LocationPicker } from "@/components/map/location-picker";
import type { GeocodedLocation } from "@/lib/location/types";

type Pin = { lat: number; lng: number };
export type EnquiryDetailsValue = {
  isAsap: boolean;
  scheduledStartAt: string | null;
  addressText: string;
  lat: number | null;
  lng: number | null;
  place: "home" | "different";
  isValid: boolean;
};

type Props = {
  homeAddress: string;
  homeCity: string | null;
  baseTown: string | null;
  homePin: Pin | null;
  today: string;
  initial?: Partial<EnquiryDetailsValue>;
  onChange: (value: EnquiryDetailsValue) => void;
};

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function localTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(11, 16);
}

function localFutureDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function EnquiryDetailsFields({
  homeAddress,
  homeCity,
  baseTown,
  homePin,
  today,
  initial,
  onChange,
}: Props) {
  const id = useId();
  const initialScheduledAt = initial?.scheduledStartAt ? new Date(initial.scheduledStartAt) : null;
  const [when, setWhen] = useState<"asap" | "schedule">(initial?.isAsap === false ? "schedule" : "asap");
  const [date, setDate] = useState(initialScheduledAt && !Number.isNaN(initialScheduledAt.getTime()) ? localDateValue(initialScheduledAt) : "");
  const [time, setTime] = useState(initialScheduledAt && !Number.isNaN(initialScheduledAt.getTime()) ? localTimeValue(initialScheduledAt) : "");
  const [place, setPlace] = useState<"home" | "different">(initial?.place ?? "home");
  const [addressText, setAddressText] = useState(initial?.addressText ?? homeAddress);
  const [pin, setPin] = useState<Pin | null>(
    initial?.lat != null && initial.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : initial?.place === "different" ? null : homePin,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const addressRevisionRef = useRef(0);
  const reverseRequestRef = useRef(0);

  const scheduledAt = localFutureDateTime(date, time);
  const scheduledTimestamp = scheduledAt?.getTime() ?? null;
  const address = place === "home" ? homeAddress || homeCity || "" : addressText;
  const selectedPin = place === "home" ? homePin : pin;
  const selectedLat = selectedPin?.lat ?? null;
  const selectedLng = selectedPin?.lng ?? null;
  const scheduleIsInvalid = when === "schedule" && (scheduledTimestamp === null || scheduledTimestamp <= nowMs);
  const minTimeDate = new Date(nowMs + 60_000);
  const minTime = date === today ? `${String(minTimeDate.getHours()).padStart(2, "0")}:${String(minTimeDate.getMinutes()).padStart(2, "0")}` : undefined;

  useEffect(() => {
    onChange({
      isAsap: when === "asap",
      scheduledStartAt: when === "schedule" && scheduledTimestamp !== null ? new Date(scheduledTimestamp).toISOString() : null,
      addressText: address.trim(),
      lat: selectedLat,
      lng: selectedLng,
      place,
      isValid: !scheduleIsInvalid && Boolean(address.trim()),
    });
  }, [address, onChange, place, scheduleIsInvalid, scheduledTimestamp, selectedLat, selectedLng, when]);

  useEffect(() => {
    if (when !== "schedule") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [when]);

  function openLocationPicker() {
    setPickerOpen(true);
  }

  async function handlePin(point: Pin, suggestion?: GeocodedLocation | null) {
    setPin(point);
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
      // Typing and saving the selected point do not depend on reverse geocoding.
    } finally {
      if (requestId === reverseRequestRef.current) setLookingUpAddress(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">When</p>
        <div role="group" aria-label="When should the work happen?" className="flex w-full rounded-full border border-border bg-background p-1">
          {([['asap', 'ASAP'], ['schedule', 'Schedule']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={when === value} onClick={() => { setNowMs(Date.now()); setWhen(value); }} className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${when === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        {when === "schedule" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>Date</span>
              <Input type="date" min={today} value={date} onChange={(event) => { setNowMs(Date.now()); setDate(event.target.value); }} className="min-h-12 rounded-xl bg-background text-foreground" />
            </label>
            <label className="space-y-1 text-sm font-medium text-foreground">
              <span>Time</span>
              <Input type="time" min={minTime} value={time} onChange={(event) => { setNowMs(Date.now()); setTime(event.target.value); }} className="min-h-12 rounded-xl bg-background text-foreground" />
            </label>
            {scheduleIsInvalid && <p className="text-sm text-destructive sm:col-span-2">Choose a future date and time.</p>}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Work location</p>
        <div role="group" aria-label="Choose the work location" className="flex w-full rounded-full border border-border bg-background p-1">
          {([['home', 'My home'], ['different', 'Different location']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={place === value} onClick={() => {
              const next = value as "home" | "different";
              setPlace(next);
              addressRevisionRef.current += 1;
              if (next === "home") {
                setAddressText(homeAddress);
                setPin(homePin);
              } else {
                setAddressText("");
                setPin(null);
              }
            }} className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${place === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>

        {place === "home" ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">{homeAddress || homeCity || "Home town not provided"}</p>
            {!homeAddress && <Link href="/profile" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Add your address</Link>}
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor={`${id}-different-address`} className="block text-sm font-medium text-foreground">Address or area</label>
            <textarea
              id={`${id}-different-address`}
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
            {!addressText.trim() && <p className="text-sm text-destructive">Enter an address or area to continue.</p>}
            {lookingUpAddress && <p role="status" className="text-xs text-muted-foreground">Filling in the address suggestion… You can keep typing.</p>}
            {pin && <LocationMap lat={pin.lat} lng={pin.lng} height={180} />}
            <button type="button" onClick={openLocationPicker} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MapPin aria-hidden="true" className="size-4" />{pin ? "Change pin (optional)" : "Add map pin (optional)"}
            </button>
            <LocationPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              initial={pin}
              baseTown={baseTown}
              title="Different work location"
              confirmLabel="Use pin"
              lookupSuggestion={false}
              onConfirm={(nextPin, suggestion) => { void handlePin(nextPin, suggestion); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}