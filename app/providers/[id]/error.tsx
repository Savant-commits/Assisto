"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-0 pb-10">
      <section role="alert" className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-soft">
        <PageHeading title="We couldn't load this provider profile." className="mb-0 pt-0" />
        <p className="mt-2 text-sm text-muted-foreground">Please try again, or return to Discover.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={reset}>Try again</Button>
          <Link href="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to discover
          </Link>
        </div>
      </section>
    </main>
  );
}
