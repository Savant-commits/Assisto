import type { SelectedLocation } from "@/lib/location/types";
import { isValidCoords } from "@/lib/maps";

export const LOCATION_COOKIE_NAME = "assisto-location";
export const RECENT_LOCATIONS_KEY = "assisto-recent-locations";

export const DEFAULT_LOCATION: SelectedLocation = {
  label: "Chidambaram, Tamil Nadu",
  locality: "Chidambaram",
  city: "Chidambaram",
  state: "Tamil Nadu",
  lat: 11.3993,
  lng: 79.6914,
  source: "default",
};

export function isSelectedLocation(value: unknown): value is SelectedLocation {
  if (typeof value !== "object" || value === null) return false;
  const location = value as Partial<SelectedLocation>;
  const optionalTextFields = [
    location.formattedLabel,
    location.street,
    location.houseNumber,
    location.neighbourhood,
    location.suburb,
    location.district,
    location.landmark,
    location.name,
  ];
  const validOptionalFields = optionalTextFields.every((field) => field === undefined || field === null || typeof field === "string");
  const validCoordinates = location.lat === null && location.lng === null ||
    typeof location.lat === "number" && typeof location.lng === "number" && isValidCoords(location.lat, location.lng);
  return validOptionalFields && typeof location.label === "string" && location.label.length > 0 && location.label.length <= 500 &&
    typeof location.locality === "string" &&
    (typeof location.city === "string" || location.city === null) &&
    location.state === "Tamil Nadu" &&
    validCoordinates &&
    ["default", "search", "map", "device", "manual"].includes(String(location.source));
}
