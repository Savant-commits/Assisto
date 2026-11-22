import { MapPin } from "lucide-react";

type Props = {
  locality: string | null;
  city: string | null;
  businessName: string;
};

export default function ProviderLocationSection({ locality, city, businessName }: Props) {
  const locationParts = [locality?.trim(), city?.trim()].filter((part): part is string => Boolean(part));
  if (locationParts.length === 0) return null;

  const locationLabel = locationParts.join(", ");
  const areaName = city?.trim() || locality?.trim();
  const mapQuery = `${locationParts.join(", ")}, Tamil Nadu`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <section className="mb-[var(--section-gap)] rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="mb-3 font-display text-xl">Where they work</h2>
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>{locationLabel}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Based in {areaName}. Share your project details in an enquiry and they will confirm if they can work at your location.
      </p>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${businessName} work area on a map (opens in a new tab)`}
        className="mt-3 inline-flex min-h-11 items-center rounded-full text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View area on map
      </a>
    </section>
  );
}
