import Link from "next/link";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { CategoryRail } from "@/components/home/category-rail";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { SectionError } from "@/components/home/section-error";
import { getCityProviders, getHomeCategories } from "@/lib/home/queries";
import type { SelectedLocation } from "@/lib/location/types";

async function loadServiceData(location: SelectedLocation) {
  try {
    return await Promise.all([
      getHomeCategories(),
      getCityProviders(location.city),
    ]);
  } catch {
    return null;
  }
}

export async function ServiceCategories({ location }: { location: SelectedLocation }) {
  const result = await loadServiceData(location);
  if (!result) return <SectionError label="Our Services" />;
  const [categories, providers] = result;
  if (categories.length === 0) {
    return (
      <section aria-labelledby="services-heading" className="min-h-64 space-y-4 lg:min-h-[22rem]">
        <div>
          <h2 id="services-heading" className="font-display text-3xl">Our Services</h2>
          <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Describe what you need</AuthGatedLink>
        </div>
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
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div>
            <h2 id="services-heading" className="font-display text-3xl">Our Services</h2>
            <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Describe what you need</AuthGatedLink>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link href="/discover" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</Link>
          </div>
        </div>
        <CategoryRail categories={cards} city={location.city} label="Service categories" columns={5} />
    </section>
  );
}
