"use client";

import * as React from "react";
import { Play } from "lucide-react";
import MediaViewer from "@/components/media-viewer";
import type { ProviderPortfolioItem } from "@/lib/types";
import { PROVIDER_MEDIA_GRID_GAP_CLASS, PROVIDER_MEDIA_TILE_CLASS } from "@/components/provider/provider-media-styles";

type Props = { items: ProviderPortfolioItem[]; providerName: string };

export default function ProviderMediaStrip({ items, providerName }: Props) {
  const visibleItems = items.slice(0, 6);
  const [open, setOpen] = React.useState(false);
  const [initialIndex, setInitialIndex] = React.useState(0);
  const [trigger, setTrigger] = React.useState<HTMLElement | null>(null);
  const viewerItems = React.useMemo(() => items.map((item) => ({
    ...item,
    description: item.description?.trim() || item.caption?.trim() || null,
  })), [items]);

  return (
    <>
      <div className={`relative z-10 grid grid-cols-3 ${PROVIDER_MEDIA_GRID_GAP_CLASS} px-4 pb-4`}>
        {visibleItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={`View ${item.media_type === "video" ? "video" : "photo"} ${index + 1}`}
            onClick={(event) => {
              setTrigger(event.currentTarget);
              setInitialIndex(items.findIndex((media) => media.id === item.id));
              setOpen(true);
            }}
            className={`group relative z-10 ${PROVIDER_MEDIA_TILE_CLASS} bg-neutral-900 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {item.media_type === "video" ? (
              <span className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden="true">
                <span className="grid justify-items-center gap-1.5">
                  <span className="grid size-10 place-items-center rounded-full border border-border bg-background text-foreground"><Play className="ml-0.5 size-5 fill-current" /></span>
                  <span className="rounded-full border border-border bg-background/90 px-2.5 py-0.5 text-xs font-medium text-foreground">Video</span>
                </span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url ?? undefined} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
      <MediaViewer
        key={`${open}-${initialIndex}`}
        open={open}
        items={viewerItems}
        providerName={providerName}
        initialIndex={initialIndex}
        trigger={trigger}
        onClose={() => setOpen(false)}
      />
    </>
  );
}