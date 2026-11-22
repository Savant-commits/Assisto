import { distanceKm } from "@/lib/geo";
import type { ProviderListItem } from "@/lib/types";

export const NEARBY_RADIUS_KM = 50;

export type GeolocatedProvider = ProviderListItem & {
  lat?: number | null;
  lng?: number | null;
};

export type NearbyProvider<T extends GeolocatedProvider = GeolocatedProvider> = {
  provider: T;
  distanceKm: number;
};

export function sameCity(first: string | null | undefined, second: string | null | undefined): boolean {
  return Boolean(first?.trim() && second?.trim() && first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase());
}

export function groupProviders<T extends GeolocatedProvider>(
  providers: T[],
  effectiveCity: string,
  coordinates: { lat: number; lng: number } | null,
): { local: T[]; nearby: NearbyProvider<T>[] } {
  const local: T[] = [];
  const nearby: NearbyProvider<T>[] = [];

  for (const provider of providers) {
    if (sameCity(provider.city, effectiveCity)) {
      local.push(provider);
      continue;
    }
    if (!coordinates || typeof provider.lat !== "number" || typeof provider.lng !== "number" ||
      !Number.isFinite(provider.lat) || !Number.isFinite(provider.lng)) continue;
    const distance = distanceKm(coordinates, { lat: provider.lat, lng: provider.lng });
    if (Number.isFinite(distance) && distance <= NEARBY_RADIUS_KM) {
      nearby.push({ provider, distanceKm: distance });
    }
  }

  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  return { local, nearby };
}
