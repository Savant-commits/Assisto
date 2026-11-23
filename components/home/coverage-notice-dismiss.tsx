"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function CoverageNoticeDismiss({ locationKey, children }: { locationKey: string; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function dismiss() {
    const notice = noticeRef.current;
    if (notice) {
      const nextFocusable = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find((element) =>
        !notice.contains(element) && Boolean(notice.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
      nextFocusable?.focus({ preventScroll: true });
    }

    document.cookie = `assisto-coverage-dismissed=${encodeURIComponent(locationKey)}; path=/; SameSite=Lax`;
    setDismissed(true);
    router.refresh();
  }

  return (
    <div
      ref={noticeRef}
      aria-hidden={dismissed}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${dismissed ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
    >
      <div className="relative min-h-0 overflow-hidden">
        {children}
        <button
          type="button"
          aria-label="Dismiss local coverage notice"
          onClick={dismiss}
          className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}