import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type HomeCategory = {
  id: string;
  slug: string;
  name: string;
  sort_order: number | null;
};

export type HomeProvider = {
  id: string;
  business_name: string | null;
  city: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  provider_categories: Array<{ category_id: string }> | null;
};

export type LocallyOfferedService = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  providerCount: number;
};

export function getHomeCityHint(location: {
  city: string | null;
  locality: string;
  label: string;
}): string | null {
  const city = location.city?.trim();
  if (city && !["selected location", "tamil nadu"].includes(city.toLocaleLowerCase())) return city;

  const locality = location.locality.trim();
  const label = location.label.trim();
  if (!locality || ["selected location", "tamil nadu"].includes(locality.toLocaleLowerCase())) return null;
  const normalizedLocality = locality.toLocaleLowerCase();
  const normalizedLabel = label.toLocaleLowerCase();
  return normalizedLabel === normalizedLocality || normalizedLabel.startsWith(`${normalizedLocality},`)
    ? locality
    : null;
}

export const getHomeCategories = cache(async (): Promise<HomeCategory[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, slug, name, sort_order")
    .order("sort_order")
    .order("name");

  if (error) throw error;
  return (data ?? []) as HomeCategory[];
});

export const getCityProviders = cache(async (city: string | null): Promise<HomeProvider[]> => {
  const normalizedCity = city?.trim().toLocaleLowerCase();
  if (!normalizedCity) return [];
  const supabase = await createClient();
  const cityPattern = `%${normalizedCity.replace(/[\\%_]/g, "\\$&")}%`;
  const providers: HomeProvider[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("providers")
      .select("id, business_name, city, locality, lat, lng, provider_categories ( category_id )")
      .eq("is_active", true)
      .ilike("city", cityPattern)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const batch = (data ?? []) as HomeProvider[];
    providers.push(...batch.filter((provider) => provider.city?.trim().toLocaleLowerCase() === normalizedCity));
    if (batch.length < 1000) return providers;
  }
});

export const getGeolocatedProviders = cache(async (): Promise<HomeProvider[]> => {
  const supabase = await createClient();
  const providers: HomeProvider[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("providers")
      .select("id, business_name, city, locality, lat, lng, provider_categories ( category_id )")
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const batch = (data ?? []) as HomeProvider[];
    providers.push(...batch);
    if (batch.length < 1000) return providers;
  }
});

export const getLocallyOfferedServices = cache(async (city: string | null): Promise<LocallyOfferedService[]> => {
  const normalizedCity = city?.trim().toLocaleLowerCase() || null;
  const cityPattern = normalizedCity ? `%${normalizedCity.replace(/[\\%_]/g, "\\$&")}%` : null;
  const supabase = await createClient();
  const serviceCounts = new Map<string, {
    id: string;
    slug: string;
    name: string;
    sort_order: number;
    providerIds: Set<string>;
  }>();

  for (let offset = 0; ; offset += 1000) {
    let query = supabase
      .from("provider_services")
      .select("provider_id,services!inner(id,slug,name,sort_order,is_active),providers!inner(id,city,is_active)")
      .eq("services.is_active", true)
      .eq("providers.is_active", true)
      .order("provider_id")
      .order("service_id")
      .range(offset, offset + 999);
    if (cityPattern) query = query.ilike("providers.city", cityPattern);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as Array<{
      provider_id: string;
      services?: { id?: string; slug?: string; name?: string; sort_order?: number | null; is_active?: boolean } |
        Array<{ id?: string; slug?: string; name?: string; sort_order?: number | null; is_active?: boolean }> | null;
      providers?: { id?: string; city?: string | null; is_active?: boolean } |
        Array<{ id?: string; city?: string | null; is_active?: boolean }> | null;
    }>;

    for (const row of batch) {
      const service = Array.isArray(row.services) ? row.services[0] : row.services;
      const provider = Array.isArray(row.providers) ? row.providers[0] : row.providers;
      const providerId = provider?.id ?? row.provider_id;
      if (
        !service?.id || !service.slug || !service.name ||
        !providerId || service.is_active !== true || provider?.is_active !== true
      ) continue;
      if (normalizedCity && provider.city?.trim().toLocaleLowerCase() !== normalizedCity) continue;

      const current = serviceCounts.get(service.id) ?? {
        id: service.id,
        slug: service.slug,
        name: service.name,
        sort_order: service.sort_order ?? 0,
        providerIds: new Set<string>(),
      };
      current.providerIds.add(providerId);
      serviceCounts.set(service.id, current);
    }

    if (batch.length < 1000) break;
  }

  return [...serviceCounts.values()]
    .map(({ providerIds, ...service }) => ({ ...service, providerCount: providerIds.size }))
    .filter((service) => service.providerCount > 0)
    .sort((a, b) => b.providerCount - a.providerCount || a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .slice(0, 12);
});

export async function getProvidersForLocation(city: string | null): Promise<HomeProvider[]> {
  return city?.trim() ? getCityProviders(city) : getGeolocatedProviders();
}
