import * as React from "react";

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-full ${className}`} />;
}

function ProviderCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft">
      <div className="flex items-center gap-3">
        <div className="skeleton size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-hidden sm:grid sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className={`skeleton aspect-[4/3] w-[calc((100%_-_1rem)_/_2.2)] shrink-0 snap-start rounded-lg sm:w-auto sm:aspect-square sm:snap-none ${item === 2 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonLine className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function DiscoverSkeleton() {
  return (
    <div aria-label="Loading professionals" aria-busy="true" className="mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-64" />
        <SkeletonLine className="h-4 w-80 max-w-full" />
      </div>
      <div className="my-3 flex h-11 items-center gap-2">
        <SkeletonLine className="h-11 flex-1 rounded-lg" />
        <SkeletonLine className="h-11 w-20 rounded-full" />
      </div>
      <div className="mb-6 flex items-center gap-2 overflow-hidden">
        <SkeletonLine className="h-10 w-40 shrink-0" />
        <SkeletonLine className="h-8 w-24 shrink-0" />
        <SkeletonLine className="h-8 w-28 shrink-0" />
        <SkeletonLine className="h-10 w-28 shrink-0 sm:ml-auto" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <ProviderCardSkeleton key={item} />)}
      </div>
    </div>
  );
}
