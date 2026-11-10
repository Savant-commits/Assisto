"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock3, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLocation } from "@/lib/location/provider";
import { useServices, type Service } from "@/hooks/use-services";

const RECENT_SEARCHES_KEY = "assisto-recent-searches";

type Category = { slug: string; name: string };
type Professional = { id: string; business_name: string };
type PopularCategory = { slug: string; name: string; scope: string | null };

function readRecentSearches() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function discoverUrl(params: { category?: string; service?: string; city?: string | null }) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.service) query.set("service", params.service);
  if (params.city) query.set("city", params.city);
  return `/discover?${query.toString()}`;
}

function recordSearch(query: string, current: string[]) {
  const normalized = query.trim();
  if (!normalized) return current;
  const next = [normalized, ...current.filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(0, 8);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Search history is best-effort when browser storage is unavailable.
  }
  return next;
}

export default function SearchOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { location } = useLocation();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<PopularCategory[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLElement | null>(null);
  const { services, loading: isLoadingServices } = useServices(query, 8);

  useEffect(() => {
    if (!open) return;
    searchTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      setQuery("");
      setRecentSearches(readRecentSearches());
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.setTimeout(() => searchTrigger.current?.focus(), 0);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const supabase = createClient();
    const loadingTimer = window.setTimeout(() => setIsLoadingCategories(true), 0);
    Promise.all([
      supabase.from("service_categories").select("slug,name").order("sort_order"),
      supabase.rpc("popular_categories", { p_city: location.city }),
    ]).then(([categoryResult, popularResult]) => {
      if (!mounted) return;
      setCategories((categoryResult.data ?? []) as Category[]);
      if (popularResult.error || !Array.isArray(popularResult.data)) {
        setPopular([]);
      } else {
        const rows = popularResult.data as Array<Record<string, unknown>>;
        setPopular(rows.flatMap((row) => {
          const slug = typeof row.slug === "string" ? row.slug : typeof row.category_slug === "string" ? row.category_slug : null;
          const name = typeof row.name === "string" ? row.name : typeof row.category_name === "string" ? row.category_name : null;
          if (!slug || !name) return [];
          return [{ slug, name, scope: typeof row.scope === "string" ? row.scope : null }];
        }));
      }
      setIsLoadingCategories(false);
    }).catch(() => {
      if (!mounted) return;
      setCategories([]);
      setPopular([]);
      setIsLoadingCategories(false);
    });
    return () => {
      mounted = false;
      window.clearTimeout(loadingTimer);
    };
  }, [location.city, open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      const clearTimer = window.setTimeout(() => setProfessionals([]), 0);
      return () => window.clearTimeout(clearTimer);
    }

    let mounted = true;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      let request = supabase
        .from("providers")
        .select("id,business_name")
        .eq("is_active", true)
        .ilike("business_name", `%${trimmed}%`)
        .not("business_name", "is", null)
        .limit(3);
      if (location.city) request = request.ilike("city", location.city);
      try {
        const { data } = await request;
        if (mounted) {
          setProfessionals((data ?? []).filter((row) => typeof row.id === "string" && typeof row.business_name === "string") as Professional[]);
        }
      } catch {
        if (mounted) setProfessionals([]);
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [location.city, open, query]);

  const hasQuery = query.trim().length > 0;
  const noMatchingService = hasQuery && !isLoadingServices && services.length === 0;

  function navigate(href: string, selectedQuery?: string) {
    if (selectedQuery) setRecentSearches((current) => recordSearch(selectedQuery, current));
    onOpenChange(false);
    router.push(href);
  }

  function selectService(service: Service) {
    navigate(discoverUrl({ service: service.slug, city: location.city }), query || service.name);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const count = hasQuery ? services.length + professionals.length : categories.length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActiveIndex((index) => index <= 0 ? count - 1 : index - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (hasQuery && services[activeIndex]) {
        selectService(services[activeIndex]);
      } else if (hasQuery && activeIndex >= services.length && professionals[activeIndex - services.length]) {
        const professional = professionals[activeIndex - services.length];
        navigate(`/providers/${professional.id}`, query);
      } else if (hasQuery && services.length > 0) {
        selectService(services[0]);
      } else if (!hasQuery && categories[activeIndex]) {
        navigate(discoverUrl({ category: categories[activeIndex].slug, city: location.city }), categories[activeIndex].name);
      } else if (!hasQuery && categories.length > 0) {
        navigate(discoverUrl({ category: categories[0].slug, city: location.city }), categories[0].name);
      }
    }
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
  }

  const popularScope = popular.some((item) => item.scope?.toLocaleLowerCase().includes("state") || item.scope?.toLocaleLowerCase().includes("tamil nadu")) || !location.city
    ? "Tamil Nadu"
    : location.city;
  const activeDescendant = !hasQuery
    ? categories[activeIndex] ? `search-category-${activeIndex}` : undefined
    : activeIndex < services.length
      ? services[activeIndex] ? `search-service-${activeIndex}` : undefined
      : professionals[activeIndex - services.length] ? `search-professional-${activeIndex - services.length}` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-overlay-title"
        tabIndex={-1}
        onKeyDown={trapFocus}
        className="fixed inset-0 m-0 flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 md:relative md:inset-auto md:h-[min(90dvh,800px)] md:w-full md:max-w-3xl md:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <h2 id="search-overlay-title" className="sr-only">Search for a service</h2>
          <label htmlFor="full-search-input" className="sr-only">Search for services, categories, or professionals</label>
          <input
            ref={inputRef}
            id="full-search-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasQuery}
            aria-controls="full-search-results"
            aria-activedescendant={activeDescendant}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="What do you need help with?"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="button" aria-label="Close search" onClick={() => onOpenChange(false)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <p aria-live="polite" className="sr-only">
            {hasQuery ? `${services.length} services and ${professionals.length} professionals found` : `${categories.length} categories available`}
          </p>

          {!hasQuery && recentSearches.length > 0 && (
            <section aria-labelledby="recent-searches-heading" className="mb-7">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="recent-searches-heading" className="text-sm font-semibold">Recent searches</h3>
                <button type="button" onClick={clearRecentSearches} className="min-h-11 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recentSearches.map((recent) => (
                  <li key={recent}>
                    <button type="button" onClick={() => {
                      setQuery(recent);
                      inputRef.current?.focus();
                    }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
                      {recent}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!hasQuery && (
            <section aria-labelledby="categories-heading" className="mb-7">
              <h3 id="categories-heading" className="mb-2 text-sm font-semibold">Categories</h3>
              {isLoadingCategories && <p className="py-3 text-sm text-muted-foreground">Loading categories…</p>}
              <ul id="full-search-results" role="listbox" aria-label="Categories" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categories.map((category, index) => (
                  <li key={category.slug}>
                    <button
                      id={`search-category-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      onClick={() => navigate(discoverUrl({ category: category.slug, city: location.city }), category.name)}
                      className={`flex min-h-12 w-full items-center justify-between rounded-xl border border-border px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeIndex === index ? "bg-muted" : ""}`}
                    >
                      {category.name}
                      <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!hasQuery && popular.length > 0 && (
            <section aria-labelledby="popular-categories-heading" className="mb-7">
              <h3 id="popular-categories-heading" className="mb-2 text-sm font-semibold">Popular in {popularScope}</h3>
              <ul className="flex flex-wrap gap-2">
                {popular.map((category) => (
                  <li key={`${category.slug}-${category.scope}`}>
                    <button type="button" onClick={() => navigate(discoverUrl({ category: category.slug, city: location.city }), category.name)} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{category.name}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasQuery && (
            <div id="full-search-results" role="listbox" aria-label="Search results" className="space-y-7">
              {services.length > 0 && (
                <section aria-labelledby="matching-services-heading">
                  <h3 id="matching-services-heading" className="mb-2 text-sm font-semibold">Services</h3>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {services.map((service, index) => (
                      <li key={service.slug}>
                        <button
                          id={`search-service-${index}`}
                          type="button"
                          role="option"
                          aria-selected={activeIndex === index}
                          onClick={() => selectService(service)}
                          className={`flex min-h-12 w-full items-center justify-between px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${activeIndex === index ? "bg-muted" : "hover:bg-muted"}`}
                        >
                          {service.name}
                          <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {professionals.length > 0 && (
                <section aria-labelledby="professionals-heading">
                  <h3 id="professionals-heading" className="mb-2 text-sm font-semibold">Professionals</h3>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {professionals.map((professional, index) => (
                      <li key={professional.id}>
                        <button id={`search-professional-${index}`} type="button" role="option" aria-selected={activeIndex === services.length + index} onClick={() => navigate(`/providers/${professional.id}`, query)} className="flex min-h-12 w-full items-center justify-between px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          {professional.business_name}
                          <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {noMatchingService && (
                <section className="rounded-xl border border-border p-4">
                  <h3 className="font-semibold">No services match</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try browsing a category or describe what you need.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setQuery("")} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Browse categories</button>
                    <button type="button" onClick={() => navigate("/requirements/new", query)} className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm text-primary-foreground hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Describe what you need</button>
                  </div>
                </section>
              )}

              {popular.length > 0 && (
                <section aria-labelledby="popular-categories-heading">
                  <h3 id="popular-categories-heading" className="mb-2 text-sm font-semibold">Popular in {popularScope}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {popular.map((category) => (
                      <li key={`${category.slug}-${category.scope}`}>
                        <button type="button" onClick={() => navigate(discoverUrl({ category: category.slug, city: location.city }), query)} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{category.name}</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
        <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {location.city
            ? <>Searching in <span className="font-medium text-foreground">{location.locality || location.label}</span></>
            : <>Searching across Tamil Nadu · Location: <span className="font-medium text-foreground">{location.locality || location.label}</span></>}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
