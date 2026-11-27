export function HomeSectionSkeleton({
  kind,
}: {
  kind: "coverage" | "hero" | "categories" | "popular" | "recruitment";
}) {
  if (kind === "hero") {
    return (
      <div aria-hidden="true">
        <div className="skeleton h-[clamp(240px,46dvh,380px)] w-full rounded-3xl md:h-[clamp(360px,52vh,520px)] lg:h-[clamp(420px,60vh,640px)]" />
        <div className="mt-0 flex min-h-11 items-center justify-between sm:mt-3">
          <div className="flex gap-1"><div className="skeleton size-11 rounded-full" /><div className="skeleton size-11 rounded-full" /><div className="skeleton size-11 rounded-full" /></div>
          <div className="skeleton h-11 w-24 rounded-full" />
        </div>
      </div>
    );
  }
  if (kind === "categories" || kind === "popular") {
    const count = kind === "categories" ? 5 : 6;
    if (kind === "categories") {
      return (
        <section aria-hidden="true" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton h-9 w-36 rounded-lg" />
            <div className="skeleton h-11 w-20 rounded-full" />
          </div>
          <div className="flex h-11 items-center gap-2 overflow-hidden">
            <div className="skeleton h-4 w-28 shrink-0 rounded-md" />
            {[36, 28, 32, 24].map((width, index) => <div key={index} className="skeleton h-11 shrink-0 rounded-full" style={{ width: `${width * 4}px` }} />)}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1].map((index) => <div key={index} className="skeleton aspect-[4/5] rounded-2xl border border-forest/45" />)}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="skeleton aspect-[4/5] rounded-2xl" />)}
          </div>
        </section>
      );
    }
    return (
      <section aria-hidden="true" className="min-h-64 space-y-4">
        <div className="skeleton h-8 w-52 rounded-lg" />
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
