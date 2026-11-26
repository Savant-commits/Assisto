import { Suspense } from "react";
import { cookies } from "next/headers";
import { HomeRefresh } from "@/components/home/home-refresh";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { CoverageNotice } from "@/components/home/coverage-notice";
import { HeroSection } from "@/components/home/hero-section";
import { ServiceCategories } from "@/components/home/service-categories";
import { ProviderRecruitment } from "@/components/home/provider-recruitment";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocation } from "@/lib/location/server";
import { getCityProviders, getHomeCityHint } from "@/lib/home/queries";

export default async function HomePage() {
  const [location, supabase, cookieStore] = await Promise.all([getSelectedLocation(), createClient(), cookies()]);
  const coverageLocationKey = JSON.stringify([location.locality, location.city]);
  const dismissedCoverageKey = cookieStore.get("assisto-coverage-dismissed")?.value;
  const { data: authData } = await supabase.auth.getUser();
  let role: string | null = null;
  if (authData.user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    role = typeof profile?.role === "string" ? profile.role : null;
  }
  const hideRecruitment = role === "provider" || role === "admin";
  const coverageArea = getHomeCityHint(location);
  let showCoverage = !coverageArea;
  if (coverageArea) {
    try {
      showCoverage = (await getCityProviders(coverageArea)).length === 0;
    } catch {
      showCoverage = true;
    }
  }
  const showCoverageNotice = showCoverage && dismissedCoverageKey !== coverageLocationKey && dismissedCoverageKey !== encodeURIComponent(coverageLocationKey);

  return (
    <HomeRefresh>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--section-gap)] overflow-x-clip px-4 py-6 sm:py-10">
        <h1 className="sr-only">Find the right professional for your home</h1>
        {showCoverageNotice && (
          <Suspense fallback={<HomeSectionSkeleton kind="coverage" />}>
            <CoverageNotice key={coverageLocationKey} location={location} locationKey={coverageLocationKey} />
          </Suspense>
        )}
        <Suspense fallback={<HomeSectionSkeleton kind="hero" />}>
          <HeroSection location={location} hideRecruitment={hideRecruitment} />
        </Suspense>
        <Suspense fallback={<HomeSectionSkeleton kind="categories" />}>
          <ServiceCategories location={location} />
        </Suspense>
        {!hideRecruitment && (
          <Suspense fallback={<HomeSectionSkeleton kind="recruitment" />}>
            <ProviderRecruitment />
          </Suspense>
        )}
      </main>
    </HomeRefresh>
  );
}
