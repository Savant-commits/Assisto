import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-0 pb-10">
      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-soft">
        <PageHeading title="Provider not found" description="This provider profile is unavailable." className="mb-0 pt-0" />
        <Link href="/discover" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to discover
        </Link>
      </section>
    </main>
  );
}
