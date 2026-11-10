"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Service = {
  id: string;
  slug: string;
  name: string;
  category_id?: string;
};

type ServiceRow = { id: unknown; slug: string; name: string; category_id?: unknown };

let cachedServices: Service[] | null = null;
let servicesRequest: Promise<Service[]> | null = null;

async function loadActiveServices(): Promise<Service[]> {
  if (cachedServices) return cachedServices;
  if (!servicesRequest) {
    servicesRequest = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("services")
        .select("id,slug,name,category_id")
        .eq("is_active", true)
        .order("category_id")
        .order("sort_order");
      if (error) throw error;
      cachedServices = ((data ?? []) as ServiceRow[])
        .filter((row) => typeof row.slug === "string" && typeof row.name === "string")
        .map((row) => ({
          id: String(row.id),
          slug: row.slug,
          name: row.name,
          category_id: row.category_id == null ? undefined : String(row.category_id),
        }));
      return cachedServices;
    })().catch((error: unknown) => {
      servicesRequest = null;
      throw error;
    });
  }
  return servicesRequest;
}

export function useServices(query = "", limit = 20) {
  const [allServices, setAllServices] = useState<Service[]>(cachedServices || []);
  const [loading, setLoading] = useState(!cachedServices);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  useEffect(() => {
    let mounted = true;
    loadActiveServices()
      .then((services) => {
        if (mounted) setAllServices(services);
      })
      .catch(() => {
        if (mounted) setAllServices([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const services = useMemo(() => {
    const matching = normalizedQuery
      ? allServices.filter((service) =>
        service.name.toLocaleLowerCase().includes(normalizedQuery) ||
        service.slug.toLocaleLowerCase().includes(normalizedQuery)
      )
      : allServices;
    return matching.slice(0, limit);
  }, [allServices, limit, normalizedQuery]);

  return { allServices, services, loading };
}
