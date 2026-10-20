const ALLOWED_MAPS_URL_PATTERN = /^https:\/\/((www\.)?google\.(com|co\.in)\/maps([/?][^\s]*)?|maps\.google\.(com|co\.in)\/[^\s]*|maps\.app\.goo\.gl\/[^\s]*|goo\.gl\/maps\/[^\s]*)$/i;

const DEFAULT_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_MAP_TILE_URL;
export const MAP_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;

export const DEFAULT_MAP_CENTER = { lat: 11.748, lng: 79.7714 } as const;

export const CITY_CENTERS = {
  Cuddalore: { lat: 11.748, lng: 79.7714 },
  Chidambaram: { lat: 11.3993, lng: 79.6914 },
} as const;

// Keep this in sync with the providers_maps_url_chk and enquiry_locations_maps_url_chk constraints.
export function isAllowedMapsUrl(url: string): boolean {
  return url.length <= 300 && ALLOWED_MAPS_URL_PATTERN.test(url);
}

export function coordsViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function coordsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function joinLocationParts(first?: string | null, second?: string | null): string {
  return [first?.trim(), second?.trim()].filter((part): part is string => Boolean(part)).join(", ");
}

export function directionsUrl(opts: {
  mapsUrl?: string | null;
  address?: string | null;
  city?: string | null;
}): string | null {
  if (opts.mapsUrl && isAllowedMapsUrl(opts.mapsUrl)) return opts.mapsUrl;

  const address = opts.address?.trim();
  if (!address) return null;

  const destination = joinLocationParts(address, opts.city);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function viewOnMapUrl(opts: {
  mapsUrl?: string | null;
  locality?: string | null;
  city?: string | null;
}): string | null {
  if (opts.mapsUrl && isAllowedMapsUrl(opts.mapsUrl)) return opts.mapsUrl;

  const query = joinLocationParts(opts.locality, opts.city);
  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const EXTERNAL_LINK_PROPS = { target: "_blank", rel: "noopener noreferrer" } as const;
