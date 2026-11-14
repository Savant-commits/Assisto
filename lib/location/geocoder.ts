import type { GeocodedLocation } from "@/lib/location/types";

const rateLimitWindowMs = 60_000;
const rateLimitLimit = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
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

  const district = text(properties.district);
  const kind = text(properties.osm_value) ?? text(properties.type) ?? "place";
  const featureName = text(properties.name);
  const osmKey = text(properties.osm_key);
  const isRoad = osmKey === "highway";
  const street = isRoad ? featureName ?? text(properties.street) : text(properties.street);
  const houseNumber = text(properties.housenumber) ?? text(properties.house_number);
  const neighbourhood = text(properties.neighbourhood) ?? text(properties.neighborhood);
  const suburb = text(properties.suburb);
  const postcode = text(properties.postcode);
  const city = text(properties.city) ?? text(properties.town) ?? text(properties.village);
  const area = suburb ?? district ?? text(properties.locality) ?? neighbourhood;
  const locality = area ?? city ?? street ?? "";
  const landmark = featureName && !isRoad && featureName !== city && featureName !== area ? featureName : null;
  const streetAddress = [houseNumber, street].filter(Boolean).join(" ") || null;
  const labelParts = [
    streetAddress,
    area,
    landmark ? `Near ${landmark}` : null,
    city,
    postcode,
  ].filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index);
  const formattedLabel = labelParts.join(", ") || featureName || "";
  if (!formattedLabel) return null;
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
    postcode,
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

function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizePhotonReverseFeatures(
  features: PhotonFeature[],
  point: { lat: number; lng: number },
): GeocodedLocation | null {
  const valid = features.flatMap((feature) => {
    const location = normalizePhotonFeature(feature);
    return location ? [{ feature, location, distance: distanceMeters(point, { lat: location.lat!, lng: location.lng! }) }] : [];
  });
  if (!valid.length) return null;

  const byDistance = [...valid].sort((a, b) => a.distance - b.distance);
  const nearestRoad = byDistance.find(({ feature }) => text(feature.properties?.osm_key) === "highway");
  const streetCandidate = nearestRoad ?? byDistance.find(({ feature }) => text(feature.properties?.street));
  const street = streetCandidate?.location.street ?? null;
  const nearestNamedPlace = byDistance.find(({ feature, location }) =>
    text(feature.properties?.osm_key) !== "highway" && Boolean(location.name) && location.name !== location.city,
  );
  const suburb = byDistance.map(({ feature }) => text(feature.properties?.suburb)).find(Boolean) ?? null;
  const district = byDistance.map(({ feature }) => text(feature.properties?.district)).find(Boolean) ?? null;
  const localityArea = byDistance.map(({ feature }) => text(feature.properties?.locality)).find(Boolean) ?? null;
  const neighbourhood = byDistance.map(({ feature }) => text(feature.properties?.neighbourhood) ?? text(feature.properties?.neighborhood)).find(Boolean) ?? null;
  const area = suburb ?? district ?? localityArea ?? neighbourhood;
  const city = byDistance.map(({ feature }) => text(feature.properties?.city) ?? text(feature.properties?.town) ?? text(feature.properties?.village)).find(Boolean) ?? null;
  const houseNumber = byDistance.map(({ feature }) => text(feature.properties?.housenumber) ?? text(feature.properties?.house_number)).find(Boolean) ?? null;
  const postcode = streetCandidate?.location.postcode ?? byDistance.map(({ feature }) => text(feature.properties?.postcode)).find(Boolean) ?? null;
  const landmark = nearestNamedPlace?.location.name ?? null;
  const labelParts = [
    [houseNumber, street].filter(Boolean).join(" "),
    area,
    landmark && landmark !== street ? `Near ${landmark}` : null,
    city,
    postcode,
  ].filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index);
  const formattedLabel = labelParts.join(", ") || byDistance[0].location.formattedLabel || byDistance[0].location.label;
  const base = streetCandidate?.location ?? byDistance[0].location;

  return {
    ...base,
    label: formattedLabel,
    formattedLabel,
    street,
    houseNumber,
    locality: area ?? city ?? street ?? "",
    city,
    district,
    suburb,
    neighbourhood,
    landmark,
    postcode,
    lat: point.lat,
    lng: point.lng,
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
