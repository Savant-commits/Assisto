import Link from "next/link";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { HomeImageCard } from "@/components/home/image-card";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { SectionError } from "@/components/home/section-error";
import { getHomeCategories, getHomeCityHint, getLocallyOfferedServices, getProvidersForLocation, type LocallyOfferedService } from "@/lib/home/queries";
import type { SelectedLocation } from "@/lib/location/types";
import { buildDiscoverUrl } from "@/lib/location/discover-url";

function OfferedServiceChips({ services, city }: { services: LocallyOfferedService[]; city: string | null }) {
  if (services.length === 0) return null;
  const label = city ? `Near ${city}` : "Across Tamil Nadu";

  return (
    <div className="flex min-h-11 items-center gap-2">
      <p className="shrink-0 text-sm font-medium text-muted-foreground">{label}</p>
      <ul aria-label={`${label} services`} className="scrollbar-none flex min-h-11 gap-2 overflow-x-auto overflow-y-hidden">
        {services.map((service) => (
          <li key={service.id} className="shrink-0">
            <Link
              href={buildDiscoverUrl({ service: service.slug, city })}
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {service.name}
              {service.providerCount >= 2 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{service.providerCount}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function loadServiceData(city: string | null) {
  try {
    return await Promise.all([
      getHomeCategories(),
      getProvidersForLocation(city),
    ]);
  } catch {
    return null;
  }
}

export async function ServiceCategories({ location }: { location: SelectedLocation }) {
  const city = getHomeCityHint(location);
  const result = await loadServiceData(city);
  if (!result) return <SectionError label="Services" />;
  const [categories, providers] = result;
  let offeredServices: LocallyOfferedService[] = [];
  try {
    offeredServices = await getLocallyOfferedServices(city);
  } catch (error) {
    console.error("home locally offered services query failed", error);
  }
  if (categories.length === 0) {
    return (
      <section aria-labelledby="services-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="services-heading" className="font-display text-3xl">All services</h2>
          <Link href="/discover" className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</Link>
        </div>
        <OfferedServiceChips services={offeredServices} city={city} />
        <HomeEmptyState />
      </section>
    );
  }

  const counts = new Map<string, number>();
  for (const provider of providers) {
    const seen = new Set<string>();
    for (const category of provider.provider_categories ?? []) {
      if (typeof category.category_id === "string" && !seen.has(category.category_id)) {
        counts.set(category.category_id, (counts.get(category.category_id) ?? 0) + 1);
        seen.add(category.category_id);
      }
    }
  }
  const cards = categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    sortOrder: category.sort_order ?? 0,
    providerCount: counts.get(category.id) ?? 0,
  }));
  const locallyAvailable = cards
    .filter((category) => category.providerCount > 0)
    .sort((a, b) => b.providerCount - a.providerCount || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const otherCategories = cards.filter((category) => category.providerCount === 0);
  const imageCard = (category: (typeof cards)[number], size: "featured" | "compact") => (
    <HomeImageCard
      key={category.slug}
      image={`/images/categories/${category.slug}.jpg`}
      title={category.name}
      href={buildDiscoverUrl({ category: category.slug, city })}
      caption={size === "featured" ? `${category.providerCount} ${city ? `in ${city}` : "across Tamil Nadu"}` : undefined}
      size={size}
      highlighted={size === "featured"}
    />
  );
  return (
    <section aria-labelledby="services-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3 sm:items-end sm:gap-4">
          <h2 id="services-heading" className="font-display text-3xl">All services</h2>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link href="/discover" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</Link>
          </div>
        </div>
        <OfferedServiceChips services={offeredServices} city={city} />
        {locallyAvailable.length > 0 && (
          <section aria-label="Services available near you" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {locallyAvailable.map((category) => imageCard(category, "featured"))}
          </section>
        )}
        {otherCategories.length > 0 && (
          <section aria-label={locallyAvailable.length > 0 ? "More services" : "Service categories"} className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {otherCategories.map((category) => imageCard(category, "compact"))}
          </section>
        )}
        <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Describe what you need</AuthGatedLink>
    </section>
  );
}
