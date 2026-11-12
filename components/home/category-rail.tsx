"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HomeImageCard } from "@/components/home/image-card";
import { buildDiscoverUrl } from "@/lib/location/discover-url";

export type CategoryCardData = {
  slug: string;
  name: string;
  providerCount: number;
};

export function CategoryRail({
  categories,
  city,
  label,
  columns,
}: {
  categories: CategoryCardData[];
  city: string | null;
  label: string;
  columns: 5 | 6;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const columnClass = columns === 5 ? "lg:grid-cols-5" : "lg:grid-cols-6";
  const scroll = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.75, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <div ref={railRef} aria-label={label} className={`scrollbar-none grid grid-flow-col auto-cols-[43%] snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 md:px-0 lg:grid-flow-row ${columnClass} lg:auto-cols-auto lg:overflow-visible lg:px-0`}>
        {categories.map((category) => (
          <HomeImageCard
            key={category.slug}
            image={`/images/categories/${category.slug}.jpg`}
            title={category.name}
            href={buildDiscoverUrl({ category: category.slug, city })}
            caption={category.providerCount > 0 && city ? `${category.providerCount} in ${city}` : undefined}
            className="snap-start"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between md:flex lg:hidden">
        <button type="button" aria-label={`Previous ${label.toLocaleLowerCase()}`} onClick={() => scroll(-1)} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Next ${label.toLocaleLowerCase()}`} onClick={() => scroll(1)} className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
