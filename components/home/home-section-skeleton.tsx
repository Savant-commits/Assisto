export function HomeSectionSkeleton({
  kind,
}: {
  kind: "coverage" | "hero" | "categories" | "popular" | "recruitment";
}) {
  if (kind === "hero") {
    return (
      <div aria-hidden="true">
        <div className="skeleton aspect-[4/5] w-full rounded-3xl md:aspect-[16/9]" />
        <div className="mt-3 flex min-h-11 items-center justify-between">
          <div className="flex gap-1"><div className="skeleton size-11 rounded-full" /><div className="skeleton size-11 rounded-full" /><div className="skeleton size-11 rounded-full" /></div>
          <div className="skeleton h-11 w-24 rounded-full" />
        </div>
      </div>
    );
  }
  if (kind === "categories" || kind === "popular") {
    const count = kind === "categories" ? 5 : 6;
    return (
      <section aria-hidden="true" className="min-h-64 space-y-4">
        {kind === "categories" ? (
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="space-y-2">
              <div className="skeleton h-8 w-52 rounded-lg" />
              <div className="skeleton h-5 w-72 max-w-full rounded-lg" />
            </div>
            <div className="flex gap-2"><div className="skeleton h-11 w-40 rounded-full" /><div className="skeleton h-11 w-20 rounded-full" /></div>
          </div>
        ) : <div className="skeleton h-8 w-52 rounded-lg" />}
        <div className={`scrollbar-none grid grid-flow-col auto-cols-[43%] snap-x snap-mandatory gap-3 overflow-hidden lg:grid-flow-row ${count === 5 ? "lg:grid-cols-5" : "lg:grid-cols-6"}`}>
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="skeleton aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }
  if (kind === "coverage") {
    return <div aria-hidden="true" className="skeleton min-h-36 rounded-2xl" />;
  }
  return (
    <div aria-hidden="true" className="grid items-center gap-6 rounded-3xl border border-border bg-card p-5 sm:p-8 lg:grid-cols-2 lg:gap-10">
      <div className="skeleton aspect-[4/3] rounded-2xl" />
      <div className="space-y-4 py-2 lg:py-8">
        <div className="skeleton h-10 w-4/5 rounded-lg" />
        <div className="skeleton h-16 w-full rounded-lg" />
        <div className="skeleton h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}
