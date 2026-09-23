import Link from "next/link";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { ProviderListItem } from "@/lib/types";

export function ProviderCard({ provider, requirement }: { provider: ProviderListItem; requirement?: string }) {
  const name = provider.profiles?.full_name ?? provider.business_name ?? "Provider";
  const portfolioItems = (provider.provider_portfolio_items ?? []) as Array<{
    id: string | number;
    image_url?: string | null;
    description?: string | null;
    media_type?: string | null;
  }>;
  const hasPortfolio = portfolioItems.length > 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3">
          <img
            src={provider.profiles?.avatar_url ?? "/placeholder-avatar.png"}
            alt={name}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">
              <div className="flex items-center gap-2">
                <span className="truncate">{name}</span>
                {provider.is_verified && <Badge variant="secondary">Verified</Badge>}
              </div>
            </CardTitle>
            <CardDescription className="text-sm truncate">{provider.headline}</CardDescription>

            {(provider.review_count ?? 0) > 0 ? (
              <div className="text-sm mt-1">
                <span className="text-yellow-500">★</span>
                <span className="ml-1 font-medium">{(provider.avg_rating ?? 0).toFixed(1)}</span>
                <span className="ml-2 text-muted-foreground">({provider.review_count} {provider.review_count === 1 ? "review" : "reviews"})</span>
              </div>
            ) : (
              <div className="text-sm mt-1 text-muted-foreground">No reviews yet</div>
            )}
          </div>
        </div>
      </CardHeader>

      {hasPortfolio && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Work samples</p>
          <div className="grid grid-cols-3 gap-1">
            {portfolioItems.slice(0, 3).map((item) => (
              <div key={item.id} className="relative aspect-square rounded overflow-hidden bg-muted">
                {item.media_type === "video" ? (
                  <video
                    src={item.image_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={item.image_url}
                    alt="Work sample"
                    className="w-full h-full object-cover"
                  />
                )}
                {item.media_type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="text-white text-xs">▶</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CardFooter>
        <div className="flex w-full items-center justify-between">
          <div className="text-sm text-muted-foreground">{provider.city}</div>
          <Link
            href={requirement ? `/providers/${provider.id}?requirement=${requirement}` : `/providers/${provider.id}`}
            className={cn("text-sm font-medium underline")}
          >
            View profile
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default ProviderCard;
