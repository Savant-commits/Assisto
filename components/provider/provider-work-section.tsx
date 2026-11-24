"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import MediaViewer from "@/components/media-viewer";
import type { ProviderPortfolioItem } from "@/lib/types";

type MediaFilter = "all" | "photos" | "videos";
type Props = {
  items: ProviderPortfolioItem[];
  providerName: string;
  mediaFilter: MediaFilter;
  setMediaFilter: (filter: MediaFilter) => void;
  sortDirection: "latest" | "oldest";
  setSortDirection: (direction: "latest" | "oldest") => void;
  isOwner: boolean;
};

export default function ProviderWorkSection({ items, providerName, mediaFilter, setMediaFilter, sortDirection, setSortDirection, isOwner }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);

  const filteredItems = useMemo(() => [...items]
    .filter((item) => {
      if (mediaFilter === "photos") return item.media_type !== "video";
      if (mediaFilter === "videos") return item.media_type === "video";
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.created_at ?? "1970-01-01T00:00:00Z").getTime();
      const bTime = new Date(b.created_at ?? "1970-01-01T00:00:00Z").getTime();
      return sortDirection === "latest" ? bTime - aTime : aTime - bTime;
    }), [items, mediaFilter, sortDirection]);

  const hasPhotos = items.some((item) => item.media_type !== "video");
  const hasVideos = items.some((item) => item.media_type === "video");
  const visibleItems = expanded ? filteredItems : filteredItems.slice(0, 6);
  const viewerItems = useMemo(() => filteredItems.map((item) => ({
    ...item,
    description: item.description?.trim() || item.caption?.trim() || null,
  })), [filteredItems]);

  return (
    <section aria-labelledby="provider-work-heading" className="mb-[var(--section-gap)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="provider-work-heading" className="font-display text-xl text-foreground">Work samples</h2>
        <span className="shrink-0 text-sm text-muted-foreground">{filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}</span>
      </div>

      {hasPhotos && hasVideos && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter work samples">
          {([
            ["all", "All"],
            ["photos", "Photos"],
            ["videos", "Videos"],
          ] as const).map(([filter, label]) => (
            <Button
              key={filter}
              type="button"
              variant={mediaFilter === filter ? "default" : "outline"}
              aria-pressed={mediaFilter === filter}
              onClick={() => {
                setMediaFilter(filter);
                setExpanded(false);
              }}
              className="min-h-11 rounded-full px-4"
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {filteredItems.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Sort work samples">
          {([
            ["latest", "Latest"],
            ["oldest", "Oldest"],
          ] as const).map(([direction, label]) => (
            <Button
              key={direction}
              type="button"
              variant={sortDirection === direction ? "secondary" : "outline"}
              aria-pressed={sortDirection === direction}
              onClick={() => setSortDirection(direction)}
              className="min-h-10 rounded-full px-3"
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              <p>No work samples yet.</p>
              {isOwner && <Link href="/your-work" className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Add your work</Link>}
            </>
          ) : (
            <p>No work samples match this filter.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {visibleItems.map((item, index) => {
              const caption = item.caption?.trim() || item.description?.trim();
              const isVideo = item.media_type === "video";
              return (
                <article key={item.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    aria-label={`Open ${isVideo ? "video" : "photo"} work sample ${index + 1}`}
                    onClick={(event) => {
                      setInitialIndex(index);
                      setTrigger(event.currentTarget);
                      setViewerOpen(true);
                    }}
                    className="group relative block aspect-[4/3] w-full overflow-hidden bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:aspect-square"
                  >
                    {isVideo ? (
                      <video
                        src={item.image_url ?? undefined}
                        muted
                        playsInline
                        preload="metadata"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url ?? undefined}
                        alt={caption || `${providerName} work sample`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {isVideo && (
                      <span className="absolute inset-0 grid place-items-center bg-black/15 text-white" aria-hidden="true">
                        <span className="grid size-12 place-items-center rounded-full bg-black/65 shadow-md">
                          <Play aria-hidden="true" className="ml-0.5 size-6 fill-current" />
                        </span>
                      </span>
                    )}
                  </button>
                  {caption && <p className="line-clamp-1 px-2 py-1.5 text-xs text-muted-foreground">{caption}</p>}
                </article>
              );
            })}
          </div>

          {filteredItems.length > 6 && (
            <Button
              type="button"
              variant="outline"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 min-h-11 w-full rounded-full"
            >
              {expanded ? "Show fewer" : `Show all ${filteredItems.length} items`}
            </Button>
          )}
        </>
      )}

      <MediaViewer
        key={`${viewerOpen}-${initialIndex}`}
        open={viewerOpen}
        items={viewerItems}
        providerName={providerName}
        initialIndex={initialIndex}
        trigger={trigger}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  );
}