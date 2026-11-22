"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";

type Props = {
  name: string;
  avatarUrl?: string | null;
  isVerified: boolean | null;
  locality: string | null;
  city: string | null;
  yearsExperience: number | null;
  headline: string | null;
  categories: string[];
  avgRating: number | null;
  reviewCount: number | null;
};

export default function ProviderProfileHeader({
  name,
  avatarUrl,
  isVerified,
  locality,
  city,
  yearsExperience,
  headline,
  categories,
  avgRating,
  reviewCount,
}: Props) {
  const router = useRouter();
  const metaLocation = [locality, city].filter((part): part is string => Boolean(part?.trim())).join(", ");
  const hasReviewCount = typeof reviewCount === "number" && reviewCount > 0;
  const hasRating = hasReviewCount && typeof avgRating === "number" && Number.isFinite(avgRating);

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length <= 1 || !document.referrer) return;
    try {
      if (new URL(document.referrer).origin !== window.location.origin) return;
    } catch {
      return;
    }
    event.preventDefault();
    router.back();
  }

  return (
    <header className="mb-[var(--section-gap)] sm:mb-0">
      <Link
        href="/discover"
        onClick={handleBack}
        aria-label="Back to previous page"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        Back
      </Link>

      <div className="flex items-start gap-4 sm:mb-6 sm:flex-nowrap">
        <Avatar
          src={avatarUrl}
          name={name}
          size={64}
          className="h-16 w-16 shrink-0 rounded-full object-cover bg-muted"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-foreground sm:font-sans sm:tracking-normal">{name}</h1>
            {isVerified === true && <Badge variant="secondary">Credential verified</Badge>}
          </div>

          {headline?.trim() && <p className="mt-1 text-sm text-muted-foreground sm:hidden">{headline}</p>}

          <p className="mt-1 text-sm text-muted-foreground sm:hidden">
            {metaLocation && <span>{metaLocation}</span>}
            {metaLocation && yearsExperience !== null && yearsExperience > 0 && <span aria-hidden="true"> · </span>}
            {yearsExperience !== null && yearsExperience > 0 && <span>{yearsExperience} years experience</span>}
          </p>
          <p className="hidden text-muted-foreground sm:block">
            {city} · {yearsExperience ?? 0} yrs experience
          </p>

          {hasReviewCount ? (
            <>
              <p className="mt-1 text-sm text-foreground sm:hidden">
                {hasRating && <><span className="text-primary" aria-label={`${avgRating.toFixed(1)} out of 5`}>★</span> {avgRating.toFixed(1)} · </>}
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </p>
              <p className="mt-1 hidden text-sm sm:block">
                <span className="text-yellow-500">★</span> {(avgRating ?? 0).toFixed(1)}{" "}
                <span className="text-muted-foreground">({reviewCount} reviews)</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground sm:hidden">No reviews yet</p>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">New on Assisto — no reviews yet</p>
            </>
          )}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-4 mb-0 flex flex-wrap gap-2 sm:mb-6 sm:mt-0 sm:gap-1">
          {categories.map((category, index) => (
            <Badge key={`${category}-${index}`} variant="outline" className="h-auto whitespace-normal py-1 text-left sm:h-5 sm:whitespace-nowrap sm:py-0.5 sm:text-xs">
              {category}
            </Badge>
          ))}
        </div>
      )}
    </header>
  );
}
