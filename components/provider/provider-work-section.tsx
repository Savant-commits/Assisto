"use client";

import * as React from "react";
import { Play } from "lucide-react";
import MediaViewer from "@/components/media-viewer";
import type { ProviderPortfolioItem } from "@/lib/types";

type MediaFilter = "all" | "photos" | "videos";
type Props = {
  items: ProviderPortfolioItem[];
  providerName: string;
  mediaFilter: MediaFilter;
  setMediaFilter: (filter: MediaFilter) => void;
  sortDirection: "latest" | "oldest";
  isOwner: boolean;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenRoot = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export default function ProviderWorkSection({ items, providerName, mediaFilter, setMediaFilter, sortDirection, isOwner }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [initialIndex, setInitialIndex] = React.useState(0);
  const [trigger, setTrigger] = React.useState<HTMLButtonElement | null>(null);
  const openRef = React.useRef(false);
  const enteredByViewerRef = React.useRef(false);
  const pendingRequestRef = React.useRef<Promise<boolean> | null>(null);

  const filteredItems = React.useMemo(() => [...items]
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

  const requestFullscreen = React.useCallback((): Promise<boolean> => {
    const doc = document as FullscreenDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return Promise.resolve(true);
    if (pendingRequestRef.current) return pendingRequestRef.current;

    const root = document.documentElement as FullscreenRoot;
    let request: Promise<void>;
    try {
      if (typeof root.requestFullscreen === "function") request = Promise.resolve(root.requestFullscreen());
      else if (typeof root.webkitRequestFullscreen === "function") request = Promise.resolve(root.webkitRequestFullscreen());
      else return Promise.resolve(false);
    } catch {
      return Promise.resolve(false);
    }

    const pending = request.then(() => {
      const currentDoc = document as FullscreenDocument;
      const entered = currentDoc.fullscreenElement === root || currentDoc.webkitFullscreenElement === root;
      if (entered) {
        enteredByViewerRef.current = true;
        if (!openRef.current) {
          try {
            if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
            else if (currentDoc.webkitExitFullscreen) void Promise.resolve(currentDoc.webkitExitFullscreen()).catch(() => {});
          } catch {}
        }
      }
      return entered;
    }).catch(() => false).finally(() => {
      if (pendingRequestRef.current === pending) pendingRequestRef.current = null;
    });
    pendingRequestRef.current = pending;
    return pending;
  }, []);

  function openViewer(index: number, event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.matchMedia("(max-width: 639px)").matches || openRef.current) return;
    openRef.current = true;
    enteredByViewerRef.current = false;
    setTrigger(event.currentTarget);
    setInitialIndex(index);
    const doc = document as FullscreenDocument;
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) void requestFullscreen();
    setViewerOpen(true);
  }

  const closeViewer = React.useCallback(async () => {
    openRef.current = false;
    try {
      const doc = document as FullscreenDocument;
      const root = document.documentElement;
      if (enteredByViewerRef.current && (doc.fullscreenElement === root || doc.webkitFullscreenElement === root)) {
        try {
          if (doc.fullscreenElement === root) await document.exitFullscreen();
          else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        } catch {}
      }
    } finally {
      enteredByViewerRef.current = false;
      setViewerOpen(false);
    }
  }, []);

  const viewerItems = React.useMemo(() => filteredItems.map((item) => ({
    ...item,
    description: item.description?.trim() || item.caption?.trim() || null,
  })), [filteredItems]);

  return (
    <section aria-labelledby="provider-work-heading" className="mb-8 sm:hidden">
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
            <button
              key={filter}
              type="button"
              aria-pressed={mediaFilter === filter}
              onClick={() => {
                setMediaFilter(filter);
                setExpanded(false);
              }}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mediaFilter === filter ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              <p>No work samples yet.</p>
              {isOwner && <a href="/your-work" className="mt-2 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Add your work</a>}
            </>
          ) : (
            <p>No work samples match this filter.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {visibleItems.map((item) => {
              const sourceIndex = filteredItems.findIndex((filtered) => filtered.id === item.id);
              const caption = item.caption?.trim() || item.description?.trim();
              const isVideo = item.media_type === "video";
              return (
                <div key={item.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    aria-label={`Open work sample ${sourceIndex + 1} of ${filteredItems.length}`}
                    aria-describedby={isVideo ? `work-video-description-${sourceIndex}` : undefined}
                    onClick={(event) => openViewer(sourceIndex, event)}
                    className="group relative block aspect-[4/3] w-full overflow-hidden bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    {isVideo ? (
                      <span className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden="true">
                        <Play aria-hidden="true" className="size-8 fill-current" />
                      </span>
                    ) : (
                      <img
                        src={item.image_url ?? undefined}
                        alt={caption || `${providerName} work sample`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                  {isVideo && <span id={`work-video-description-${sourceIndex}`} className="sr-only">Play video</span>}
                  {caption && <p className="line-clamp-1 px-2 py-1.5 text-xs text-muted-foreground">{caption}</p>}
                </div>
              );
            })}
          </div>

          {filteredItems.length > 6 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? "Show fewer" : `Show all ${filteredItems.length} items`}
            </button>
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
        requestFullscreen={requestFullscreen}
        onClose={closeViewer}
      />
    </section>
  );
}
