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
  if (!city) return [];
  const supabase = await createClient();
  const providers: HomeProvider[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("providers")
      .select("id, business_name, city, locality, lat, lng, provider_categories ( category_id )")
      .eq("is_active", true)
      .ilike("city", city)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const batch = (data ?? []) as HomeProvider[];
    providers.push(...batch);
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
