"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EXTERNAL_LINK_PROPS, coordsViewUrl, formatCoords } from "@/lib/maps";

export function ShareLocationMenu({ lat, lng }: { lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualValue, setManualValue] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    const width = menuRect?.width ?? 256;
    const height = menuRect?.height ?? 224;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - height - 8);

    setPosition({ top, left });
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    updatePosition();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setManualValue(null);
      window.setTimeout(() => setCopied(false), 1400);
      return;
    } catch {
      setManualValue(value);
      setCopied(false);
    }
  };

  const shareUrl = coordsViewUrl(lat, lng);
  const coordsText = formatCoords(lat, lng);

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        Share location
      </button>

      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[1200] max-h-[min(80vh,24rem)] w-64 overflow-y-auto rounded-md border bg-background p-2 shadow-lg"
        >
          <div className="space-y-1">
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={async () => {
                await copyValue(shareUrl);
                setOpen(false);
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={async () => {
                await copyValue(coordsText);
                setOpen(false);
              }}
            >
              Copy coordinates
            </button>
            {canShare && (
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={async () => {
                  try {
                    await navigator.share({ title: "Location", url: shareUrl });
                  } catch {
                    // Ignore share cancellation.
                  }
                  setOpen(false);
                }}
              >
                Share...
              </button>
            )}
            <a
              href={shareUrl}
              {...EXTERNAL_LINK_PROPS}
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              Open in Google Maps
            </a>
          </div>

          {copied && <p className="mt-2 text-xs text-green-600">Copied</p>}
          {manualValue && (
            <input
              readOnly
              value={manualValue}
              className="mt-2 w-full rounded border bg-muted px-2 py-1 text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
