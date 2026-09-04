import Link from "next/link";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { cn } from "@/lib/utils";
import type { ProviderListItem } from "@/lib/types";

export function ProviderCard({ provider }: { provider: ProviderListItem }) {
  const name = provider.profiles?.full_name ?? provider.business_name ?? "Provider";
  const portfolioItems = (provider.provider_portfolio_items as any[]) || [];
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
            <CardTitle className="truncate">{name}</CardTitle>
            <CardDescription className="text-sm truncate">{provider.headline}</CardDescription>
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
            href={`/providers/${provider.id}`}
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
