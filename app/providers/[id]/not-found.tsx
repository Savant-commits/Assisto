import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-soft">
        <h1 className="font-display text-2xl">Provider not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This provider profile is unavailable.</p>
        <Link href="/discover" className="mt-4 inline-flex min-h-11 items-center rounded-full px-4 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Back to discover
        </Link>
      </section>
    </main>
  );
}
