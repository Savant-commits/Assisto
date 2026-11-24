import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProviderCard } from "@/components/provider-card";
import ServicePicker from "@/components/service-picker";
import type { ProviderListItem, ProviderPortfolioItem, ProviderProfile, ServiceCategory } from "@/lib/types";
import { one } from "@/lib/relations";
import { getSelectedLocation } from "@/lib/location/server";
import DiscoverSearchToggle from "@/components/discover/discover-search-toggle";
import DiscoverFilterStrip from "@/components/discover/discover-filter-strip";
import DiscoverLocationChip from "@/components/discover/discover-location-chip";
import { groupProviders, sameCity, type GeolocatedProvider } from "@/lib/discover/group-providers";

type ProviderListRow = GeolocatedProvider & {
  profiles?: ProviderProfile | ProviderProfile[] | null;
};
type SearchParams = { category?: string; city?: string; requirement?: string; service?: string; sort?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}
function isNullableNumber(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "number";
}
function isNullableBoolean(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "boolean";
}
function isProviderProfile(value: unknown): value is ProviderProfile {
  return isRecord(value) &&
    (value.full_name === undefined || value.full_name === null || typeof value.full_name === "string") &&
    (value.avatar_url === undefined || value.avatar_url === null || typeof value.avatar_url === "string");
}
function isProviderPortfolioItem(value: unknown): value is ProviderPortfolioItem {
  return isRecord(value) && typeof value.id === "string" && isNullableString(value.image_url) &&
    isNullableString(value.caption) && isNullableString(value.description) && isNullableString(value.media_type) &&
    isNullableNumber(value.sort_order) && isNullableString(value.created_at);
}
function isProviderListRow(value: unknown): value is ProviderListRow {
  if (!isRecord(value) || typeof value.id !== "string" ||
    !isNullableString(value.business_name) || !isNullableString(value.headline) || !isNullableString(value.city) ||
    !isNullableString(value.locality) || !isNullableNumber(value.lat) || !isNullableNumber(value.lng) ||
    !isNullableNumber(value.avg_rating) || !isNullableNumber(value.review_count) || !isNullableBoolean(value.is_verified)) return false;
  const profiles = value.profiles;
  if (profiles != null && !(Array.isArray(profiles) ? profiles.every(isProviderProfile) : isProviderProfile(profiles))) return false;
  const portfolioItems = value.provider_portfolio_items;
  return portfolioItems == null || (Array.isArray(portfolioItems) && portfolioItems.every(isProviderPortfolioItem));
}
function isProviderListRows(value: unknown): value is ProviderListRow[] {
  return Array.isArray(value) && value.every(isProviderListRow);
}

function buildDiscoverUrl({ city, category, service, requirement, sort }: SearchParams) {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (category) params.set("category", category);
  if (service) params.set("service", service);
  if (requirement) params.set("requirement", requirement);
  if (sort && sort !== "recommended") params.set("sort", sort);
  const query = params.toString();
  return `/discover${query ? `?${query}` : ""}`;
}

async function getMetadataNames(params: SearchParams) {
  const supabase = await createClient();
  let categoryName: string | null = null;
  let serviceName: string | null = null;
  if (params.category) {
    const { data } = await supabase.from("service_categories").select("slug, name").eq("slug", params.category).maybeSingle();
    categoryName = typeof data?.name === "string" ? data.name : null;
  }
  if (params.service) {
    const { data } = await supabase.from("services").select("slug, name").eq("slug", params.service).maybeSingle();
    serviceName = typeof data?.name === "string" ? data.name : null;
  }
  return { categoryName, serviceName };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const [location, names] = await Promise.all([getSelectedLocation(), getMetadataNames(params)]);
  const city = params.city?.trim() || location.city?.trim() || location.locality || location.label;
  const categoryName = params.category ? names.categoryName : null;
  const filterName = params.category ? categoryName : (params.service ? names.serviceName : null);
  const title = filterName
    ? `${filterName} professionals in ${city} | Assisto`
    : `Find a professional in ${city} | Assisto`;
  const description = `Browse verified ${filterName ?? "home-service"} professionals near ${city}.`;
  return { title, description };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { category, city, requirement, service, sort } = params;
  const selectedSort = sort === "top-rated" ? "top-rated" : "recommended";
  const [selectedLocation, supabase] = await Promise.all([getSelectedLocation(), createClient()]);
  const effectiveCity = city?.trim() || selectedLocation.city?.trim() || selectedLocation.locality || selectedLocation.label;
  const coordinatesMatchCity = !city || sameCity(city, selectedLocation.city);
  const browsingCoordinates = coordinatesMatchCity && selectedLocation.lat !== null && selectedLocation.lng !== null
    ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
    : null;

  const { data: categoriesData, error: categoriesError } = await supabase
    .from("service_categories")
    .select("id, slug, name")
    .order("sort_order");
  if (categoriesError) console.error("discover categories query failed", categoriesError);
  const categories = (categoriesData ?? []) as ServiceCategory[];

  let serviceRecord: { id: number; slug: string; name: string; category_id: number } | null = null;
  if (service) {
    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("id,slug,name,category_id")
      .eq("slug", service)
      .maybeSingle();
    if (serviceError) console.error("discover service lookup failed", serviceError);
    if (serviceData) serviceRecord = serviceData;
  }

  let includeProviderServices = Boolean(serviceRecord);
  const providerCategoriesSelect = category
    ? "provider_categories!inner ( service_categories ( id, slug, name ) )"
    : "provider_categories ( service_categories ( id, slug, name ) )";
  const querySelect =
    `id, business_name, headline, city, locality, lat, lng, avg_rating, review_count, is_verified,
     profiles ( full_name, avatar_url ), ${providerCategoriesSelect},
     provider_portfolio_items ( id, image_url, description, media_type, sort_order, created_at )`;

  let matchedServiceIds: number[] = [];
  if (requirement && !service) {
    const { data: req, error: requirementError } = await supabase
      .from("customer_requirements")
      .select("id, title, description")
      .eq("id", requirement)
      .single();
    if (requirementError) console.error("discover requirement lookup failed", requirementError);
    if (req?.description) {
      const { data: allServices, error: allServicesError } = await supabase
        .from("services")
        .select("id,slug,name")
        .eq("is_active", true);
      if (allServicesError) console.error("discover service matching query failed", allServicesError);
      const normalizedDescription = req.description.toLocaleLowerCase();
      matchedServiceIds = (allServices ?? [])
        .filter((entry: { id: number; name?: string | null }) => Boolean(entry.name) && normalizedDescription.includes(entry.name!.toLocaleLowerCase()))
        .map((entry: { id: number }) => entry.id)
        .filter(Boolean);
      if (matchedServiceIds.length) includeProviderServices = true;
    }
  }

  const finalSelect = includeProviderServices ? `${querySelect}, provider_services!inner ( service_id )` : querySelect;
  let providerQuery = supabase.from("providers").select(finalSelect).eq("is_active", true);
  providerQuery = providerQuery.order("sort_order", { foreignTable: "provider_portfolio_items", ascending: true });
  providerQuery = providerQuery.order("created_at", { foreignTable: "provider_portfolio_items", ascending: true });
  providerQuery = providerQuery.order("id");

  if (category) {
    const selectedCategory = categories.find((entry) => entry.slug === category);
    if (selectedCategory) providerQuery = providerQuery.eq("provider_categories.category_id", selectedCategory.id);
  }
  if (serviceRecord) providerQuery = providerQuery.eq("provider_services.service_id", serviceRecord.id);
  if (matchedServiceIds.length) providerQuery = providerQuery.in("provider_services.service_id", matchedServiceIds);

  const providerRows: ProviderListRow[] = [];
  let providerError: Error | null = null;
  for (let offset = 0; ; offset += 1000) {
    const { data: providerBatch, error } = await providerQuery.range(offset, offset + 999);
    if (error) {
      providerError = error;
      console.error("discover providers query failed", error);
      break;
    }
    if (!isProviderListRows(providerBatch)) {
      providerError = new Error("Discover returned invalid provider data.");
      break;
    }
    providerRows.push(...providerBatch as unknown as ProviderListRow[]);
    if (providerBatch.length < 1000) break;
  }
  const normalizedProviders = providerRows.map((row) => ({ ...row, profiles: one(row.profiles) }));
  const { local, nearby } = groupProviders(normalizedProviders, effectiveCity, browsingCoordinates);
  const sortedLocal: GeolocatedProvider[] = [...local].sort((a, b) => {
    if (selectedSort === "recommended") {
      const usableMedia = (provider: ProviderListItem) => (provider.provider_portfolio_items ?? []).some(
        (item) => typeof item.image_url === "string" && item.image_url.trim().length > 0,
      );
      const score = (provider: ProviderListItem) => (provider.is_verified === true ? 1 : 0) + (usableMedia(provider) ? 1 : 0);
      return score(b) - score(a);
    }
    const aCount = Number(a.review_count ?? 0);
    const bCount = Number(b.review_count ?? 0);
    const aRating = Number(a.avg_rating ?? 0);
    const bRating = Number(b.avg_rating ?? 0);
    if (aCount === 0 && bCount === 0) return bRating - aRating;
    if (aCount === 0) return 1;
    if (bCount === 0) return -1;
    if (bRating !== aRating) return bRating - aRating;
    return bCount - aCount;
  });

  const categoryFilterItems = categories.map((entry) => {
    const active = category === entry.slug;
    return {
      slug: entry.slug,
      name: entry.name,
      active,
      href: buildDiscoverUrl({ ...params, category: active ? undefined : entry.slug, sort: selectedSort }),
    };
  });
  const sortHref = buildDiscoverUrl({ ...params, sort: selectedSort === "top-rated" ? undefined : "top-rated" });
  const clearFiltersHref = buildDiscoverUrl({ city, requirement, sort: selectedSort });
  const queryError = Boolean(categoriesError || providerError);
  const retryHref = buildDiscoverUrl({ ...params, sort: selectedSort });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="sm:hidden [&>div>p]:hidden">
        <DiscoverSearchToggle city={city} category={category} requirement={requirement} />
        <p className="mb-3 text-sm text-muted-foreground">Browse verified professionals near {effectiveCity}.</p>
      </div>
      <h1 className="mb-1 hidden text-2xl font-semibold sm:block">Find a professional</h1>
      <p className="mb-6 hidden text-muted-foreground sm:block">Browse verified professionals near {effectiveCity}.</p>

      <DiscoverFilterStrip
        locationChip={<DiscoverLocationChip variant="mobile" />}
        categories={categoryFilterItems}
        sort={selectedSort}
        sortHref={sortHref}
      />

      <div className="mb-6 hidden flex-wrap items-center gap-2 sm:flex">
        <DiscoverLocationChip variant="desktop" />
        <div className="mb-2 w-full sm:mb-0 sm:w-auto">
          <ServicePicker initialSlug={service} category={category} city={city} requirement={requirement} />
        </div>
        {categoryFilterItems.map((item) => (
          <a key={item.slug} href={item.href} className={`rounded-full border px-3 py-1 text-sm ${item.active ? "bg-foreground text-background" : ""}`}>
            {item.name}
          </a>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          {[
            { value: "recommended", label: "Recommended" },
            { value: "top-rated", label: "Top rated" },
          ].map((option) => {
            const active = selectedSort === option.value;
            return (
              <a key={option.value} href={buildDiscoverUrl({ ...params, sort: active ? undefined : option.value })} className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-foreground text-background" : ""}`}>
                {option.label}
              </a>
            );
          })}
        </div>
      </div>

      {queryError ? (
        <div role="alert" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft">
          <p className="font-medium">We couldn&apos;t load professionals right now.</p>
          <Link href={retryHref} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</Link>
        </div>
      ) : local.length === 0 && nearby.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-8 text-card-foreground">
          <p>No professionals match yet in {effectiveCity} or nearby.</p>
          <Link href="/requirements/new" className="mt-3 inline-flex min-h-11 items-center rounded-full px-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Post what you need and we&apos;ll help you find someone
          </Link>
          {(category || service) && <Link href={clearFiltersHref} className="ml-4 inline-flex min-h-11 items-center rounded-full px-1 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear filters</Link>}
        </div>
      ) : (
        <>
          {local.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedLocal.map((provider) => <ProviderCard key={provider.id} provider={provider} requirement={requirement} />)}
            </div>
          )}
          {local.length === 0 && nearby.length > 0 && (
            <div className="mb-5 rounded-2xl border border-border bg-muted/60 p-4 text-sm text-foreground">
              No professionals in {effectiveCity} match yet. Here are professionals from nearby areas.
            </div>
          )}
          {nearby.length > 0 && (
            <section aria-labelledby="nearby-areas-heading" className={local.length > 0 ? "mt-10" : ""}>
              <h2 id="nearby-areas-heading" className="text-xl font-semibold">Nearby areas</h2>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">Professionals from surrounding areas. Distances are approximate.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map(({ provider, distanceKm }) => <ProviderCard key={provider.id} provider={provider} requirement={requirement} nearbyDistanceKm={distanceKm} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
