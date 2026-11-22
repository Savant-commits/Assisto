"use client";

type Props = {
  onActivate: () => void;
};

export default function ProviderActionBar({ onActivate }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 p-3 shadow-lifted backdrop-blur sm:hidden">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={onActivate}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Send enquiry
        </button>
      </div>
    </div>
  );
}
