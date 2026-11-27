"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function HomeImageCard({
  image,
  title,
  href,
  caption,
  className,
  size = "featured",
  highlighted = false,
}: {
  image: string;
  title: string;
  href: string;
  caption?: string;
  className?: string;
  size?: "featured" | "compact";
  highlighted?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Link href={href} aria-label={caption ? `${title}, ${caption}` : title} className={cn("group relative block aspect-[4/5] min-w-0 overflow-hidden rounded-2xl bg-sage text-white shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", highlighted && "border border-forest/45", className)}>
      {!imageFailed && (
        <Image
          src={image}
          alt=""
          fill
          sizes={size === "featured" ? "(min-width: 1184px) 25vw, (min-width: 768px) 30vw, 48vw" : "(min-width: 1184px) 16vw, (min-width: 768px) 22vw, 31vw"}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="image-scrim absolute inset-0" aria-hidden="true" />
      <span className={cn("image-copy-backdrop absolute inset-x-0 bottom-0 z-10 rounded-b-2xl", size === "featured" ? "p-3 sm:p-4" : "p-2.5 sm:p-3")}>
        <span className={cn("block break-words font-display leading-tight", size === "featured" ? "text-lg sm:text-xl md:text-2xl" : "text-sm sm:text-base")}>{title}</span>
        {caption && <span className={cn("mt-1 block text-white/95", size === "featured" ? "text-xs sm:text-sm" : "text-xs")}>{caption}</span>}
      </span>
    </Link>
  );
}
