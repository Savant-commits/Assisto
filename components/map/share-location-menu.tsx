"use client";

import { useState } from "react";
import { EXTERNAL_LINK_PROPS, coordsViewUrl, formatCoords } from "@/lib/maps";

export function ShareLocationMenu({ lat, lng }: { lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualValue, setManualValue] = useState<string | null>(null);

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
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        Share location
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border bg-background p-2 shadow-lg">
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
        </div>
      )}
    </div>
  );
}
