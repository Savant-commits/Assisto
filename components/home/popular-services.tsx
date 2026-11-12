import { CategoryRail } from "@/components/home/category-rail";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { SectionError } from "@/components/home/section-error";
import { createClient } from "@/lib/supabase/server";
import { getCityProviders, getHomeCategories } from "@/lib/home/queries";
import type { SelectedLocation } from "@/lib/location/types";

type PopularRow = { slug?: unknown; name?: unknown; scope?: unknown };
type PopularCard = { slug: string; name: string; providerCount: number };

async function loadPopularData(location: SelectedLocation): Promise<{ cards: PopularCard[]; heading: string } | null> {
  try {
    const [categories, providers, supabase] = await Promise.all([
      getHomeCategories(),
      getCityProviders(location.city),
      createClient(),
    ]);
    const { data, error } = await supabase.rpc("popular_categories", {
      p_city: location.city,
      p_limit: 6,
    });

    let cards: PopularCard[] = [];
    let heading = location.city ? `Available in ${location.city}` : "Available across Tamil Nadu";
    if (!error && Array.isArray(data) && data.length > 0) {
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
      const rows = data as PopularRow[];
      cards = rows.flatMap((row) => {
        const slug = typeof row.slug === "string" ? row.slug : null;
        const category = slug ? categoryBySlug.get(slug) : undefined;
        if (!category) return [];
        return [{ slug: category.slug, name: category.name, providerCount: 0 }];
      }).slice(0, 6);
      if (cards.length > 0) {
        heading = rows[0]?.scope === "statewide"
          ? "Popular across Tamil Nadu"
          : location.city ? `Popular in ${location.city}` : "Popular across Tamil Nadu";
      }
    }

    if (cards.length === 0) {
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
      cards = categories
        .map((category) => ({ slug: category.slug, name: category.name, providerCount: counts.get(category.id) ?? 0 }))
        .filter((category) => category.providerCount > 0)
        .sort((a, b) => b.providerCount - a.providerCount || a.name.localeCompare(b.name))
        .slice(0, 6);
    }

    return { cards, heading };
  } catch {
    return null;
  }
}

export async function PopularServices({ location }: { location: SelectedLocation }) {
  const data = await loadPopularData(location);
  if (!data) return <SectionError label="Popular in your area" />;
  if (data.cards.length === 0) {
    return (
      <section aria-labelledby="popular-heading" className="min-h-64 space-y-4">
        <h2 id="popular-heading" className="font-display text-3xl">{data.heading}</h2>
        <HomeEmptyState message={location.city ? `No categories have local provider availability in ${location.city} yet.` : "No categories with provider availability are listed yet."} />
      </section>
    );
  }
  return (
    <section aria-labelledby="popular-heading" className="space-y-4">
      <h2 id="popular-heading" className="font-display text-3xl">{data.heading}</h2>
      <CategoryRail categories={data.cards} city={location.city} label="Popular categories" columns={6} />
    </section>
  );
}
