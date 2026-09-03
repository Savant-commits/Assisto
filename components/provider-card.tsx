import Link from "next/link";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { cn } from "@/lib/utils";
import type { ProviderListItem } from "@/lib/types";

export function ProviderCard({ provider }: { provider: ProviderListItem }) {
  const name = provider.profiles?.full_name ?? provider.business_name ?? "Provider";

  return (
    <Card className="hover:shadow-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <img
            src={provider.profiles?.avatar_url ?? "/placeholder-avatar.png"}
            alt={name}
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <CardTitle>{name}</CardTitle>
            <CardDescription className="text-sm">{provider.headline}</CardDescription>
          </div>
        </div>
      </CardHeader>
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
