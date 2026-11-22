function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-full ${className}`} />;
}

export default function ProviderProfileSkeleton() {
  return (
    <div aria-label="Loading provider profile" aria-busy="true" className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start gap-4">
        <div aria-hidden="true" className="skeleton h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-6 w-48 max-w-[65%]" />
            <SkeletonLine className="h-5 w-28" />
          </div>
          <SkeletonLine className="h-4 w-44" />
          <SkeletonLine className="h-4 w-32" />
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <SkeletonLine className="h-5 w-20" />
        <SkeletonLine className="h-5 w-24" />
        <SkeletonLine className="h-5 w-16" />
      </div>

      <div className="mb-8 space-y-3 rounded-lg border border-border p-4">
        <SkeletonLine className="h-5 w-40" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-4/5" />
      </div>

      <div className="mb-8 space-y-3">
        <SkeletonLine className="h-5 w-24" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((tile) => (
            <div key={tile} aria-hidden="true" className="skeleton aspect-[4/3] w-full rounded-md" />
          ))}
        </div>
      </div>

      <div className="mb-8 space-y-3 rounded-lg border border-border p-4">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-3/4" />
      </div>

      <div className="mb-8 space-y-3">
        <SkeletonLine className="h-5 w-24" />
        <SkeletonLine className="h-4 w-40" />
        <SkeletonLine className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
