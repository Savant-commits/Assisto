"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <section role="alert" className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-soft">
        <h1 className="font-display text-2xl">We couldn&apos;t load this provider profile.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again, or return to Discover.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={reset}>Try again</Button>
          <Link href="/discover" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Back to discover
          </Link>
        </div>
      </section>
    </main>
  );
}
