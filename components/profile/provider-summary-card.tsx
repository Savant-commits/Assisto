import Link from "next/link";

type ProviderSummaryCardProps = {
  providerId: string;
  categories: string[];
  yearsExperience: number | null;
  about: string | null;
};

export function ProviderSummaryCard({ providerId, categories, yearsExperience, about }: ProviderSummaryCardProps) {
  return (
    <section aria-labelledby="your-provider-profile-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="your-provider-profile-heading" className="font-display text-xl">Your provider profile</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">What customers see</p>
        </div>
        <Link href={`/providers/${providerId}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View public profile
        </Link>
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Service / category</dt>
          <dd className="mt-1 font-medium">{categories.length ? categories.join(", ") : "No categories selected"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Experience</dt>
          <dd className="mt-1 font-medium">{yearsExperience === null ? "Not provided" : `${yearsExperience} ${yearsExperience === 1 ? "year" : "years"}`}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">About</dt>
          <dd className="mt-1 line-clamp-3 whitespace-pre-line text-foreground">{about?.trim() || "No About details added yet."}</dd>
        </div>
      </dl>
    </section>
  );
}
