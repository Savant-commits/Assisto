import type { GeocodedLocation } from "@/lib/location/types";

const rateLimitWindowMs = 60_000;
const rateLimitLimit = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const placeKindsWithCityFallback = new Set(["city", "town", "village", "suburb", "district"]);

export function allowGeocodeRequest(ip: string): boolean {
  const now = Date.now();
  const current = requestCounts.get(ip);
  if (!current || current.resetAt <= now) {
    requestCounts.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
    if (requestCounts.size > 2000) {
      for (const [key, entry] of requestCounts) {
        if (entry.resetAt <= now) requestCounts.delete(key);
      }
    }
    return true;
  }
  if (current.count >= rateLimitLimit) return false;
  current.count += 1;
  return true;
}

export type PhotonFeature = {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePhotonFeature(feature: PhotonFeature): GeocodedLocation | null {
  const properties = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (
    !properties ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) return null;
  if (properties.countrycode !== "IN" || properties.state !== "Tamil Nadu") return null;

  const lng = coordinates[0];
  const lat = coordinates[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const district = text(properties.district) ?? text(properties.county);
  const kind = text(properties.osm_value) ?? text(properties.type) ?? "place";
  const featureName = text(properties.name);
  const street = text(properties.street);
  const houseNumber = text(properties.housenumber) ?? text(properties.house_number);
  const neighbourhood = text(properties.neighbourhood) ?? text(properties.neighborhood);
  const suburb = text(properties.suburb);
  const postcode = text(properties.postcode);
  const city = text(properties.city) ?? text(properties.town) ?? text(properties.village) ??
    (placeKindsWithCityFallback.has(kind.toLowerCase()) ? featureName ?? district : null);
  const displayName = featureName ?? street ?? city ?? district ?? "Tamil Nadu";
  const locality = text(properties.locality) ?? text(properties.suburb) ?? text(properties.neighbourhood) ?? city ?? street ?? displayName;
  const knownComponents = [street, neighbourhood, suburb, text(properties.locality), district, city];
  const landmark = featureName && !knownComponents.includes(featureName) ? featureName : null;
  const streetAddress = [houseNumber, street].filter(Boolean).join(" ") || null;
  const labelParts = [
    streetAddress,
    landmark ? `Near ${landmark}` : null,
    neighbourhood,
    suburb,
    postcode,
    district,
    city,
  ].filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index);
  const formattedLabel = (labelParts.length ? labelParts : [displayName]).join(", ");
  const osmType = text(properties.osm_type) ?? "place";
  const osmId = properties.osm_id == null ? `${lat.toFixed(5)},${lng.toFixed(5)}` : String(properties.osm_id);

  return {
    id: `${osmType}/${osmId}`,
    label: formattedLabel,
    formattedLabel,
    name: featureName,
    landmark,
    street,
    houseNumber,
    neighbourhood,
    suburb,
    locality,
    city,
    district,
    state: "Tamil Nadu",
    lat,
    lng,
    kind,
    source: "search",
  };
}

export function photonBaseUrl(): string {
  const base = process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io";
  return base.replace(/\/+$/, "");
}

export function geocodeResponseHeaders() {
  return {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
  };
}
