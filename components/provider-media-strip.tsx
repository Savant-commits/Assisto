import { Play } from "lucide-react";
import type { ProviderPortfolioItem } from "@/lib/types";

type Props = {
  items: ProviderPortfolioItem[];
  providerName: string;
};

export default function ProviderMediaStrip({ items, providerName }: Props) {
  const usableItems = items
    .filter((item) => typeof item.image_url === "string" && item.image_url.trim().length > 0)
    .slice(0, 6);

  if (usableItems.length === 0) return null;

  return (
    <>
      <div className="px-4 sm:hidden">
        <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto">
          {usableItems.map((item) => {
            const alt = item.description?.trim() || `Work by ${providerName}`;
            const isVideo = item.media_type === "video";

            return (
              <div
                key={item.id}
                aria-label={isVideo ? `Video by ${providerName}` : undefined}
                className="relative z-10 aspect-[4/3] shrink-0 snap-start overflow-hidden rounded-lg bg-stone"
                style={{ width: "calc((100% - 1rem) / 2.2)" }}
              >
                {isVideo ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-foreground">
                    <span className="flex size-10 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft">
                      <Play aria-hidden="true" className="size-5 fill-current" />
                    </span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">Video</span>
                  </div>
                ) : (
                  <img
                    src={item.image_url ?? undefined}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden px-4 pb-3 sm:block">
        <p className="mb-2 text-xs text-muted-foreground">Work samples</p>
        <div className="grid grid-cols-3 gap-1">
          {usableItems.slice(0, 3).map((item) => {
            const alt = item.description?.trim() || `Work by ${providerName}`;
            const isVideo = item.media_type === "video";

            return (
              <div key={item.id} className="relative z-10 aspect-square overflow-hidden rounded bg-stone">
                {isVideo ? (
                  <div
                    aria-label={`Video by ${providerName}`}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-foreground"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft">
                      <Play aria-hidden="true" className="size-4 fill-current" />
                    </span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">Video</span>
                  </div>
                ) : (
                  <img
                    src={item.image_url ?? undefined}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
