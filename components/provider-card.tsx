import Link from "next/link";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { ProviderListItem, ProviderPortfolioItem } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import ProviderMediaStrip from "@/components/provider-media-strip";

export function ProviderCard({ provider, requirement, nearbyDistanceKm }: { provider: ProviderListItem; requirement?: string; nearbyDistanceKm?: number }) {
  const name = provider.profiles?.full_name ?? provider.business_name ?? "Provider";
  const profileHref = requirement ? `/providers/${provider.id}?requirement=${requirement}` : `/providers/${provider.id}`;
  const portfolioItems = ((provider.provider_portfolio_items ?? []) as ProviderPortfolioItem[]).filter(
    (item) => typeof item.image_url === "string" && item.image_url.trim().length > 0
  );

  return (
    <Card className="relative max-sm:active:bg-muted/50 overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar
            src={provider.profiles?.avatar_url}
            name={name}
            size={48}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">
              <div className="flex items-center gap-2">
                <Link
                  href={profileHref}
                  className="truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-sm:after:absolute max-sm:after:inset-0 max-sm:after:content-[''] sm:hidden"
                >
                  {name}
                </Link>
                <span className="truncate max-sm:hidden">{name}</span>
                {provider.is_verified && <Badge variant="secondary">Credential verified</Badge>}
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

      {portfolioItems.length > 0 && (
        <ProviderMediaStrip items={portfolioItems} providerName={name} />
      )}

      <CardFooter>
        <div className="flex w-full flex-col gap-1 text-sm text-muted-foreground">
          {nearbyDistanceKm === undefined ? (
            <>
              <div>{provider.city}</div>
              {provider.locality && <div>Based at {provider.locality}</div>}
            </>
          ) : (
            <>
              {(provider.locality || provider.city) && <div>Based at {[provider.locality, provider.city].filter(Boolean).join(", ")}</div>}
              <div>{nearbyDistanceKm < 1 ? "under 1 km away" : `about ${Math.round(nearbyDistanceKm)} km away`}</div>
            </>
          )}
          <Link
            href={profileHref}
            className={cn("mt-1 text-sm font-medium underline max-sm:hidden")}
          >
            View profile
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default ProviderCard;
