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
}: {
  image: string;
  title: string;
  href: string;
  caption?: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Link href={href} aria-label={caption ? `${title}, ${caption}` : title} className={cn("group relative block aspect-[4/5] min-w-0 overflow-hidden rounded-2xl bg-sage text-white shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
      {!imageFailed && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 43vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="image-scrim absolute inset-0" aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0 z-10 p-4">
        <span className="block font-display text-xl leading-tight md:text-2xl">{title}</span>
        {caption && <span className="mt-1 block text-sm text-white/95">{caption}</span>}
      </span>
    </Link>
  );
}
