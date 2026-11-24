import type { GeocodedLocation } from "@/lib/location/types";
import { DEFAULT_LOCATION } from "@/lib/location/default";

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

type ReversePoint = { lat: number; lng: number };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function featureDistance(feature: PhotonFeature, point: ReversePoint): number {
  const coordinates = feature.geometry?.coordinates;
  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number" ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) return Number.POSITIVE_INFINITY;

  const latitude = coordinates[1] * Math.PI / 180;
  const pointLatitude = point.lat * Math.PI / 180;
  const latitudeDelta = latitude - pointLatitude;
  const longitudeDelta = (coordinates[0] - point.lng) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(pointLatitude) * Math.cos(latitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function normalizePhotonReverseFeatures(features: PhotonFeature[], point: ReversePoint): GeocodedLocation {
  const nearestFirst = features
    .map((feature, index) => ({ feature, index, properties: feature.properties ?? {}, distance: featureDistance(feature, point) }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index);
  const road = nearestFirst.find(({ properties }) =>
    text(properties.osm_key)?.toLocaleLowerCase() === "highway" && text(properties.name),
  );
  const streetFeature = road ?? nearestFirst.find(({ properties }) => text(properties.street));
  const street = text(road?.properties.name) ?? text(streetFeature?.properties.street);
  const houseNumber = text(road?.properties.housenumber) ?? text(road?.properties.house_number) ??
    nearestFirst.map(({ properties }) => text(properties.housenumber) ?? text(properties.house_number)).find(Boolean) ?? null;
  const area = (["suburb", "district", "locality", "neighbourhood"] as const)
    .map((key) => nearestFirst.map(({ properties }) => text(properties[key])).find(Boolean))
    .find(Boolean) ?? null;
  const city = (["city", "town", "village"] as const)
    .map((key) => nearestFirst.map(({ properties }) => text(properties[key])).find(Boolean))
    .find(Boolean) ?? null;
  const postcode = text(road?.properties.postcode);
  const landmark = nearestFirst.find(({ properties }) => {
    const key = text(properties.osm_key)?.toLocaleLowerCase();
    const name = text(properties.name);
    return Boolean(name && key !== "highway" && name !== street && name !== area && name !== city);
  });
  const landmarkName = text(landmark?.properties.name);
  const uniqueParts = (parts: Array<string | null>) =>
    parts.filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  const formattedLabel = uniqueParts([
    [houseNumber, street].filter(Boolean).join(" ") || null,
    area,
    city,
    postcode,
  ]).join(", ");
  const selectedFeature = road ?? nearestFirst[0];
  const osmType = text(selectedFeature?.properties.osm_type) ?? "point";
  const osmId = selectedFeature?.properties.osm_id == null
    ? `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`
    : String(selectedFeature.properties.osm_id);
  const name = street ?? area ?? city ?? "Selected location";

  return {
    id: `${osmType}/${osmId}`,
    label: formattedLabel || area || city || "Selected location",
    name,
    locality: area ?? city ?? street ?? "Selected location",
    city,
    area,
    district: text(nearestFirst.map(({ properties }) => text(properties.district)).find(Boolean)),
    suburb: text(nearestFirst.map(({ properties }) => text(properties.suburb)).find(Boolean)),
    neighbourhood: text(nearestFirst.map(({ properties }) => text(properties.neighbourhood)).find(Boolean)),
    street,
    houseNumber,
    postcode,
    landmark: landmarkName,
    formattedLabel,
    state: "Tamil Nadu",
    lat: point.lat,
    lng: point.lng,
    kind: text(road?.properties.osm_value) ?? "address",
    source: "map",
  };
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
  const placeName = text(properties.name);
  const osmValue = text(properties.osm_value)?.toLocaleLowerCase();
  const photonType = text(properties.type)?.toLocaleLowerCase();
  const cityKinds = new Set(["city", "town", "village", "suburb", "district", "locality"]);
  const isCityLikeFeature = Boolean(
    (osmValue && cityKinds.has(osmValue)) ||
    (photonType && cityKinds.has(photonType)),
  );
  const city = text(properties.city) ?? text(properties.town) ?? text(properties.village) ?? district ??
    (isCityLikeFeature ? placeName : null);
  const name = placeName ?? text(properties.street) ?? city ?? district ?? "Tamil Nadu";
  const locality = text(properties.locality) ?? text(properties.suburb) ?? text(properties.neighbourhood) ?? city ?? text(properties.street) ?? name;
  const label = [name, city && city !== name ? city : district && district !== name ? district : null]
    .filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index)
    .join(", ");
  const osmType = text(properties.osm_type) ?? "place";
  const osmId = properties.osm_id == null ? `${lat.toFixed(5)},${lng.toFixed(5)}` : String(properties.osm_id);

  return {
    id: `${osmType}/${osmId}`,
    label,
    name,
    locality,
    city,
    district,
    state: "Tamil Nadu",
    lat,
    lng,
    kind: text(properties.osm_value) ?? text(properties.type) ?? "place",
    source: "search",
  };
}

export function photonBaseUrl(): string {
  const base = process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io";
  return base.replace(/\/+$/, "");
}

export async function resolvePhotonLocation(query: string): Promise<GeocodedLocation | null> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3 || trimmedQuery.length > 100) return null;

  const photonUrl = new URL(`${photonBaseUrl()}/api/`);
  photonUrl.searchParams.set("q", trimmedQuery);
  photonUrl.searchParams.set("limit", "8");
  photonUrl.searchParams.set("lang", "en");
  photonUrl.searchParams.set("bbox", "76.2,8.0,80.4,13.6");
  photonUrl.searchParams.set("lat", String(DEFAULT_LOCATION.lat));
  photonUrl.searchParams.set("lon", String(DEFAULT_LOCATION.lng));

  try {
    const response = await fetch(photonUrl, {
      headers: { "User-Agent": "Assisto/1.0 (Tamil Nadu location search)", Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { features?: PhotonFeature[] };
    const results = (payload.features ?? []).map(normalizePhotonFeature).filter((location) => location !== null);
    const normalizedQuery = trimmedQuery.toLocaleLowerCase();
    return results.find((location) => location.city?.trim().toLocaleLowerCase() === normalizedQuery) ?? results[0] ?? null;
  } catch {
    return null;
  }
}

export function geocodeResponseHeaders() {
  return {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
  };
}
