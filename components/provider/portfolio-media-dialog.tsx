"use client";

import { X } from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape-key";

type Props = {
  open: boolean;
  onClose: () => void;
  src: string;
  type: "image" | "video";
  alt: string;
};

export function PortfolioMediaDialog({ open, onClose, src, type, alt }: Props) {
  useEscapeKey(open, onClose);
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Portfolio media"}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close media viewer"
        className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      {type === "video" ? (
        <video
          src={src}
          controls
          playsInline
          className="max-h-[80vh] max-w-[min(90vw,80rem)] rounded-lg object-contain"
          onMouseDown={(event) => event.stopPropagation()}
        />
      ) : (
        // Native dimensions are retained while the image fits the viewport.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="max-h-[80vh] max-w-[min(90vw,80rem)] rounded-lg object-contain"
          onMouseDown={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
}