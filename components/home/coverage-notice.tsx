import Link from "next/link";
import AuthGatedLink from "@/components/auth/auth-gated-link";
import { buttonVariants } from "@/components/ui/button";
import { SectionError } from "@/components/home/section-error";
import { getCityProviders, getGeolocatedProviders } from "@/lib/home/queries";
import { distanceKm } from "@/lib/geo";
import type { SelectedLocation } from "@/lib/location/types";

type CoverageData = {
  areaName: string | null;
  unknownLocation: boolean;
  nearest: Array<{ provider: Awaited<ReturnType<typeof getGeolocatedProviders>>[number]; distance: number }>;
};

async function loadCoverageData(location: SelectedLocation): Promise<CoverageData | null | "error"> {
  try {
    const areaName = location.source === "manual" ? null : location.city;
    if (areaName) {
      const localProviders = await getCityProviders(areaName);
      if (localProviders.length > 0) return null;
    }

    const remoteProviders = location.lat !== null && location.lng !== null
      ? await getGeolocatedProviders()
      : [];
    const nearest = location.lat !== null && location.lng !== null
      ? remoteProviders
        .filter((provider) => provider.id && provider.business_name && typeof provider.lat === "number" && typeof provider.lng === "number" && (provider.locality || provider.city))
        .map((provider) => ({
          provider,
          distance: distanceKm({ lat: location.lat!, lng: location.lng! }, { lat: provider.lat!, lng: provider.lng! }),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
      : [];

    return { areaName, unknownLocation: location.source === "manual" || !areaName, nearest };
  } catch {
    return "error";
  }
}

export async function CoverageNotice({ location }: { location: SelectedLocation }) {
  const data = await loadCoverageData(location);
  if (data === null) return null;
  if (data === "error") return <SectionError label="Local coverage" />;

  return (
      <section aria-labelledby="coverage-heading" className="rounded-2xl border border-border bg-muted/60 p-5 text-foreground sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h2 id="coverage-heading" className="font-display text-2xl">{data.unknownLocation ? "A note about your selected area" : "Local coverage update"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {data.unknownLocation
                ? "We couldn’t place this location. Showing Tamil Nadu-wide results."
                : `Local coverage is limited in ${data.areaName ?? location.label}. Showing Tamil Nadu-wide results.`}
            </p>
            {data.nearest.length > 0 && (
              <ul aria-label="Providers in nearby areas" className="mt-4 divide-y divide-border">
                {data.nearest.map(({ provider, distance }) => (
                  <li key={provider.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                    <Link href={`/providers/${provider.id}`} className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {provider.business_name}
                    </Link>
                    <span className="text-muted-foreground">
                      {[provider.locality, provider.city].filter(Boolean).join(", ")} · {distance.toFixed(1)} km
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover" className={buttonVariants({ variant: "outline", className: "min-h-11" })}>Browse all professionals</Link>
            <AuthGatedLink href="/requirements/new" actionLabel="to create a requirement" className={buttonVariants({ className: "min-h-11" })}>Describe what you need</AuthGatedLink>
          </div>
        </div>
      </section>
  );
}
