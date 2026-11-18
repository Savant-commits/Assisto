import { DEFAULT_LOCATION } from "@/lib/location/default";
export { isValidCoords } from "@/lib/location/types";

const DEFAULT_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_MAP_TILE_URL;
export const MAP_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;

export const DEFAULT_MAP_CENTER = { lat: DEFAULT_LOCATION.lat!, lng: DEFAULT_LOCATION.lng! } as const;

export const CITY_CENTERS = {
  Chidambaram: DEFAULT_MAP_CENTER,
} as const;

export function coordsViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function coordsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function joinLocationParts(first?: string | null, second?: string | null): string {
  return [first?.trim(), second?.trim()].filter((part): part is string => Boolean(part)).join(", ");
}

export function directionsUrl(opts: {
  address?: string | null;
  city?: string | null;
}): string | null {
  const address = opts.address?.trim();
  if (!address) return null;

  const destination = joinLocationParts(address, opts.city);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export const EXTERNAL_LINK_PROPS = { target: "_blank", rel: "noopener noreferrer" } as const;
