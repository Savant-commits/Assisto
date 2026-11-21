"use client";

import { useEffect, useRef } from "react";

type FilterItem = {
  slug: string;
  name: string;
  href: string;
  active: boolean;
};

export default function DiscoverFilterStrip({
  cities,
  categories,
  sort,
  sortHref,
}: {
  cities: FilterItem[];
  categories: FilterItem[];
  sort: "recommended" | "top-rated";
  sortHref: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>("[data-active='true']");
    if (strip && active) {
      const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: "auto" });
    }
  }, []);

  const sortLabel = sort === "top-rated" ? "Top rated" : "Recommended";
  const nextSort = sort === "top-rated" ? "recommended" : "top-rated";

  return (
    <div className="mb-6 flex min-w-0 items-center gap-2 sm:hidden">
      <div className="relative min-w-0 flex-1">
        <div
          ref={stripRef}
          className="scrollbar-none flex snap-x snap-mandatory flex-nowrap items-center gap-2 overflow-x-auto pr-5"
        >
          {cities.map((item) => (
            <a
              key={item.slug}
              href={item.href}
              data-active={item.active ? "true" : "false"}
              className={`shrink-0 snap-start rounded-full border px-3 py-1 text-sm ${item.active ? "bg-foreground text-background" : ""}`}
            >
              {item.name}
            </a>
          ))}
          {categories.length > 0 && (
            <span aria-hidden="true" className="mx-1 h-5 shrink-0 border-l border-border" />
          )}
          {categories.map((item) => (
            <a
              key={item.slug}
              href={item.href}
              data-active={item.active ? "true" : "false"}
              className={`shrink-0 snap-start rounded-full border px-3 py-1 text-sm ${item.active ? "bg-foreground text-background" : ""}`}
            >
              {item.name}
            </a>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-background to-transparent" />
      </div>
      <a
        href={sortHref}
        aria-label={`Sorted by ${sort}. Switch to ${nextSort}.`}
        className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
      >
        {sortLabel}
      </a>
    </div>
  );
}
