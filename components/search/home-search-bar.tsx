"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useServices, type Service } from "@/hooks/use-services";
import { useLocation } from "@/lib/location/provider";
import LocationSelector from "@/components/location/location-selector";
import SearchOverlay from "@/components/search/search-overlay";

const suggestionCache = new Map<string, string[]>();
const suggestionRequests = new Map<string, Promise<string[]>>();

async function getSuggestionNames(cityKey: string, city: string | null, services: Service[]): Promise<string[]> {
  const cached = suggestionCache.get(cityKey);
  if (cached) return cached;
  const existingRequest = suggestionRequests.get(cityKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    let localServices: Service[] = [];
    if (city && services.length) {
      try {
        const supabase = createClient();
        const { data: providers, error: providerError } = await supabase
          .from("providers")
          .select("id")
          .eq("is_active", true)
          .ilike("city", city);
        if (!providerError && providers?.length) {
          const providerIds = providers.map((provider) => String(provider.id));
          const { data: providerServices, error: serviceError } = await supabase
            .from("provider_services")
            .select("service_id")
            .in("provider_id", providerIds);
          if (!serviceError) {
            const serviceIds = new Set((providerServices ?? []).map((item) => String(item.service_id)));
            localServices = services.filter((service) => serviceIds.has(service.id));
          }
        }
      } catch {
        localServices = [];
      }
    }

    const names = (localServices.length ? localServices : services)
      .map((service) => service.name)
      .filter(Boolean)
      .slice(0, 30);
    suggestionCache.set(cityKey, names);
    return names;
  })().finally(() => suggestionRequests.delete(cityKey));

  suggestionRequests.set(cityKey, request);
  return request;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export default function HomeSearchBar({ compact, firstName }: { compact: boolean; firstName?: string | null }) {
  const { location } = useLocation();
  const [open, setOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [serviceNames, setServiceNames] = useState<string[]>([]);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const { allServices, loading } = useServices("", 30);
  const cityKey = location.city?.trim().toLocaleLowerCase() || "__tamil-nadu-wide";
  const greeting = firstName?.trim()
    ? `Hello, ${firstName.trim().split(/\s+/)[0]}! What do you need today?`
    : "Hello! What do you need today?";

  useEffect(() => {
    if (loading) return;
    let mounted = true;
    void getSuggestionNames(cityKey, location.city, allServices).then((names) => {
      if (mounted) {
        setServiceNames(names);
        setIndex(0);
      }
    });
    return () => {
      mounted = false;
    };
  }, [allServices, cityKey, loading, location.city]);

  const suggestions = useMemo(() => {
    const templates = [
      (name: string) => `Looking for ${name}?`,
      (name: string) => `Search ${name}…`,
      (name: string) => `Need help with ${name}?`,
    ];
    return [greeting, ...serviceNames.flatMap((name, serviceIndex) => [templates[serviceIndex % templates.length](name)])];
  }, [greeting, serviceNames]);

  useEffect(() => {
    if (isPaused || suggestions.length < 2) return;
    let timer: number;
    const interval = reducedMotion ? 4000 : 2500;
    timer = window.setTimeout(function tick() {
      setIndex((current) => (current + 1) % suggestions.length);
      timer = window.setTimeout(tick, interval);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isPaused, reducedMotion, suggestions.length]);

  return (
    <>
      <div className={`sticky ${compact ? "top-[env(safe-area-inset-top)]" : "top-[calc(4rem+env(safe-area-inset-top))] lg:top-[calc(4.5rem+env(safe-area-inset-top))]"} z-20 border-b border-border bg-background/95 px-4 backdrop-blur transition-[top] duration-300 motion-reduce:transition-none sm:px-6`}>
        <div className="mx-auto flex max-w-7xl items-center rounded-full border border-border bg-card shadow-soft">
          <button
            ref={searchButtonRef}
            type="button"
            aria-label="Search for a service"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            onPointerEnter={() => setIsPaused(true)}
            onFocus={() => setIsPaused(true)}
            onTouchStart={() => setIsPaused(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-l-full px-4 text-left text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Search aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="h-5 min-w-0 flex-1 overflow-hidden whitespace-nowrap" aria-hidden="true">
              {reducedMotion ? (
                <span className="block truncate text-foreground">{suggestions[index] || greeting}</span>
              ) : (
                <span className="block transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateY(-${index * 1.25}rem)` }}>
                  {suggestions.map((suggestion, suggestionIndex) => (
                    <span key={`${suggestion}-${suggestionIndex}`} className="block h-5 truncate text-foreground">{suggestion}</span>
                  ))}
                </span>
              )}
            </span>
          </button>
          <div className="my-2 h-7 w-px shrink-0 bg-border" aria-hidden="true" />
          <LocationSelector />
        </div>
      </div>
      {location.source === "manual" && !location.city && (
        <p className="mx-auto max-w-7xl px-6 pb-2 text-xs text-muted-foreground">
          Using a Tamil Nadu-wide search because this location has no city set.
        </p>
      )}
      <SearchOverlay
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) window.setTimeout(() => searchButtonRef.current?.focus(), 0);
        }}
      />
    </>
  );
}
