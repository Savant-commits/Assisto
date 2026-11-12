import { HeroCarousel } from "@/components/home/hero-carousel";
import { SectionError } from "@/components/home/section-error";
import { HERO_BANNERS } from "@/lib/home/hero-banners";
import { getCityProviders, getHomeCategories } from "@/lib/home/queries";
import type { SelectedLocation } from "@/lib/location/types";

async function loadHeroBanners(location: SelectedLocation, hideRecruitment: boolean) {
  try {
    const [categories, providers] = await Promise.all([
      getHomeCategories(),
      getCityProviders(location.city),
    ]);
    const categorySlugs = new Set(categories.map((category) => category.slug));
    const activeProviderCategoryIds = new Set(
      providers.flatMap((provider) => (provider.provider_categories ?? []).map((category) => category.category_id)),
    );
    const banners = HERO_BANNERS.filter((banner) => {
      if (banner.kind === "recruit") return !hideRecruitment;
      if (banner.kind === "general") return true;
      return banner.categorySlugs.some((slug) => categorySlugs.has(slug));
    }).sort((a, b) => {
      const order = (kind: typeof a.kind) => kind === "general" ? 0 : kind === "recruit" ? 3 : 1;
      const base = order(a.kind) - order(b.kind);
      if (base) return base;
      if (a.kind !== "category" || b.kind !== "category") return 0;
      const aHasCityProvider = a.categorySlugs.some((slug) => categories.some((category) => category.slug === slug && activeProviderCategoryIds.has(category.id)));
      const bHasCityProvider = b.categorySlugs.some((slug) => categories.some((category) => category.slug === slug && activeProviderCategoryIds.has(category.id)));
      return Number(bHasCityProvider) - Number(aHasCityProvider);
    });
    return banners;
  } catch {
    return null;
  }
}

export async function HeroSection({ location, hideRecruitment }: { location: SelectedLocation; hideRecruitment: boolean }) {
  const banners = await loadHeroBanners(location, hideRecruitment);
  if (!banners) return <SectionError label="Featured banners" />;
  return <HeroCarousel banners={banners} />;
}
