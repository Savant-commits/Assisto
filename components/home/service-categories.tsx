import Link from "next/link";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { CategoryRail } from "@/components/home/category-rail";
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

async function loadServiceData(location: SelectedLocation, city: string | null) {
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
  const result = await loadServiceData(location, city);
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
      <section aria-labelledby="services-heading" className="min-h-64 space-y-4 lg:min-h-[22rem]">
        <div>
          <h2 id="services-heading" className="font-display text-3xl">Services</h2>
          <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Describe what you need</AuthGatedLink>
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
    slug: category.slug,
    name: category.name,
    providerCount: counts.get(category.id) ?? 0,
  }));
  return (
    <section aria-labelledby="services-heading" className="min-h-64 space-y-4 lg:min-h-[22rem]">
        <div className="flex items-center justify-between gap-3 sm:items-end sm:gap-4">
          <div>
            <h2 id="services-heading" className="font-display text-3xl">Services</h2>
            <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="mt-2 hidden min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">Describe what you need</AuthGatedLink>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link href="/discover" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</Link>
          </div>
        </div>
        <OfferedServiceChips services={offeredServices} city={city} />
        <CategoryRail categories={cards} city={city} label="Service categories" columns={5} />
        <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden">Describe what you need</AuthGatedLink>
    </section>
  );
}
