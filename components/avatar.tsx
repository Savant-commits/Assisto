"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
};

export function Avatar({ src, name, size, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImage = typeof src === "string" && src.length > 0 && failedSrc !== src;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (hasImage) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailedSrc(src)}
        className={className}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || "Unknown"}
      style={{ width: size, height: size }}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600", className)}
    >
      {initial}
    </div>
  );
}
