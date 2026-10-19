const ALLOWED_MAPS_URL_PATTERN = /^https:\/\/((www\.)?google\.(com|co\.in)\/maps([/?][^\s]*)?|maps\.google\.(com|co\.in)\/[^\s]*|maps\.app\.goo\.gl\/[^\s]*|goo\.gl\/maps\/[^\s]*)$/i;

// Keep this in sync with the providers_maps_url_chk and enquiry_locations_maps_url_chk constraints.
export function isAllowedMapsUrl(url: string): boolean {
  return url.length <= 300 && ALLOWED_MAPS_URL_PATTERN.test(url);
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
