import Link from "next/link";

export function HomeEmptyState({ message = "Services will appear here soon" }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-card-foreground">
      <p>{message}</p>
      <Link href="/discover" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full px-4 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Browse all professionals
      </Link>
    </div>
  );
}
